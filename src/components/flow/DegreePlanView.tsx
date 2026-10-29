import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  MarkerType,
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  OnSelectionChangeParams,
  NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import CourseNode from './customNodes/CourseNode';
import RuleNode from './customNodes/RuleNode';
import AddCourseNode from './customNodes/AddCourseNode';
import AddSemesterNode from './customNodes/AddSemesterNode';
import SemesterTitleNode from './customNodes/SemesterTitleNode';
import EditCoursesNode from './customNodes/EditCoursesNode';
import AveragesNode from './customNodes/AveragesNode';
import WeeklyHoursNode from './customNodes/WeeklyHoursNode';
import { parseCourseHours } from '../../utils/hoursCalculator';
import { calculateEarliestSemester } from '../../utils/earliestSemesterCalculator';
import { checkSeasonMismatch } from '../../utils/semesterOffering';
import { CourseSelectionModal } from '../../components/ui/CourseSelectionModal';
import { fetchAllCourses, fetchDegreeTemplates, getDefaultDegreesData } from '../../utils/dataLoader';
import { DegreeTemplate, RawCourseData, DegreeRule, PrerequisiteItem, PrerequisiteGroup } from '../../types/data';
import { CourseNodeData, RuleNodeData } from '../../types/flow';
import { evaluateRule } from '../../utils/ruleEvaluator';
import { savePlan, loadPlan, StoredPlan } from '../../utils/planStorage';
import { useTheme } from '../../hooks/useTheme';
import { numberToHebrewLetter, sortSemesterEntries, SEMESTER_0_NAME } from '../../utils/hebrewUtils';
import { checkPrerequisites, getEquivalentCourses, PrereqStatus } from '../../utils/prerequisiteChecker';
import { CourseDetailModal } from '../../components/ui/CourseDetailModal';
import { HelpModal } from '../ui/HelpModal';
import RuleEditorModal from '../../components/ui/RuleEditorModal';
import CourseListEditorModal from '../../components/ui/CourseListEditorModal';
import Logo from '../../components/ui/Logo';

import ConsolidatedRuleEditorModal from '../../components/ui/ConsolidatedRuleEditorModal';
import { useAuth } from '../../hooks/useAuth';
import { savePlanToFirestore, loadPlanFromFirestore } from '../../utils/firestoreUtils';
import AuthButtons from '../ui/AuthButtons';
import { TemplateSelectionModal } from '../../components/ui/TemplateSelectionModal';
import { ConfirmModal } from '../ui/ConfirmModal';
import { AlertModal } from '../ui/AlertModal';
import { ElectiveListsSidebar } from '../ui/ElectiveListsSidebar';
import { SpecializationPathsSidebar } from '../ui/SpecializationPathsSidebar';
import { SportsCoursesSidebar } from '../ui/SportsCoursesSidebar';
import { CreditsBanner } from '../ui/CreditsBanner';
import { OLD_SPECIALIZATION_PATHS } from '../../data/oldSpecializationPaths';
import { PanelSlot } from '../ui/PanelSlotSwitcher';
import { PlanSlotsModal } from '../ui/PlanSlotsModal';
import { PlanSlot, getActiveSlotId } from '../../utils/slotStorage';
import { ExportPlanModal } from '../ui/ExportPlanModal';

const nodeTypes = {
  course: CourseNode,
  rule: RuleNode,
  addCourse: AddCourseNode,
  addSemester: AddSemesterNode,
  semesterTitle: SemesterTitleNode,
  editCourses: EditCoursesNode,
  averages: AveragesNode,
  weeklyHours: WeeklyHoursNode,
};

const COLUMN_WIDTH = 340;
const NODE_HEIGHT_COURSE = 90;
const VERTICAL_SPACING_RULE = 60;
const HORIZONTAL_SPACING_SEMESTER = 75;
const HORIZONTAL_SPACING_RULE_GROUPS = 45; // Smaller spacing between rule groups
const SEMESTER_TOP_MARGIN = 120;
const ADD_SEMESTER_NODE_ID = 'add-new-semester-button';
const MAX_SEMESTERS = 16;
const SEMESTER_TITLE_HEIGHT = 40;
const MANDATORY_COURSES_LIST_KEY = "רשימת קורסי חובה";
const CONSOLIDATED_RULES_NODE_ID = 'consolidated-rules-node';
const GLOBAL_RULES_NODE_ID_PREFIX = 'global-rule-';

type SaveStatus = 'idle' | 'saving' | 'saved';

type ImportedPlan = {
  degreeTemplate: DegreeTemplate;
  grades: Record<string, string>;
  classificationChecked: Record<string, boolean>;
  classificationCredits: Record<string, number>;
  binaryStates: Record<string, boolean>;
  exportDate?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonNegativeFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const getStringArray = (value: unknown): string[] | null =>
  Array.isArray(value) && value.every(item => typeof item === 'string' && item.trim().length > 0)
    ? value
    : null;

const getStringRecord = (value: unknown): Record<string, string> | null => {
  if (!isRecord(value) || !Object.values(value).every(item => typeof item === 'string')) {
    return null;
  }

  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, item as string]));
};

const getBooleanRecord = (value: unknown): Record<string, boolean> | null => {
  if (!isRecord(value) || !Object.values(value).every(item => typeof item === 'boolean')) {
    return null;
  }

  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, item as boolean]));
};

const getNumberRecord = (value: unknown): Record<string, number> | null => {
  if (!isRecord(value) || !Object.values(value).every(isNonNegativeFiniteNumber)) {
    return null;
  }

  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, item as number]));
};

const normalizeImportedRule = (value: unknown): DegreeRule | null => {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.description !== 'string' || typeof value.type !== 'string') {
    return null;
  }

  const rule: DegreeRule = { id: value.id, description: value.description, type: value.type };
  const numericFields = ['required_credits', 'min_grade_value', 'min'] as const;
  for (const field of numericFields) {
    if (value[field] !== undefined) {
      if (!isNonNegativeFiniteNumber(value[field]) || (field === 'min_grade_value' && value[field] > 100)) {
        return null;
      }
      rule[field] = value[field] as number;
    }
  }

  if (value.course_list_name !== undefined) {
    if (typeof value.course_list_name !== 'string') return null;
    rule.course_list_name = value.course_list_name;
  }
  if (value.listName !== undefined) {
    if (typeof value.listName !== 'string') return null;
    rule.listName = value.listName;
  }
  if (value.id_pattern !== undefined) {
    if (typeof value.id_pattern !== 'string') return null;
    rule.id_pattern = value.id_pattern;
  }
  if (Array.isArray(value.courses)) {
    rule.courses = value.courses as DegreeRule['courses'];
  }

  for (const field of ['courses_for_min_grade', 'exclude_courses'] as const) {
    if (value[field] !== undefined) {
      const courses = getStringArray(value[field]);
      if (!courses) return null;
      rule[field] = courses;
    }
  }

  if (value.lists !== undefined) {
    if (!Array.isArray(value.lists)) return null;
    const lists = value.lists.map(item => {
      if (!isRecord(item) || typeof item.listName !== 'string') return null;
      if ((item.min !== undefined && !isNonNegativeFiniteNumber(item.min)) ||
          (item.minCredits !== undefined && !isNonNegativeFiniteNumber(item.minCredits))) {
        return null;
      }
      return {
        listName: item.listName,
        ...(item.min !== undefined ? { min: item.min as number } : {}),
        ...(item.minCredits !== undefined ? { minCredits: item.minCredits as number } : {}),
      };
    });
    if (lists.some(item => item === null)) return null;
    rule.lists = lists as NonNullable<DegreeRule['lists']>;
  }

  if (value.combinedRules !== undefined) {
    if (!Array.isArray(value.combinedRules)) return null;
    const combinedRules = value.combinedRules.map(item => {
      if (!isRecord(item) || typeof item.description !== 'string' ||
          (item.requirementType !== 'credits' && item.requirementType !== 'courses') ||
          !isNonNegativeFiniteNumber(item.min)) {
        return null;
      }
      const selectedLists = getStringArray(item.selectedLists);
      return selectedLists ? { description: item.description, selectedLists, requirementType: item.requirementType, min: item.min } : null;
    });
    if (combinedRules.some(item => item === null)) return null;
    rule.combinedRules = combinedRules as NonNullable<DegreeRule['combinedRules']>;
  }

  return rule;
};

const normalizeImportedPlan = (value: unknown): ImportedPlan | null => {
  if (!isRecord(value)) return null;

  // Forgiving plan extractor: accept degreeTemplate, template, autosavedPlan.template, or raw template object
  let rawTemplate: Record<string, unknown> | null = null;
  if (isRecord(value.degreeTemplate)) {
    rawTemplate = value.degreeTemplate;
  } else if (isRecord(value.template)) {
    rawTemplate = value.template;
  } else if (isRecord(value.autosavedPlan) && isRecord((value.autosavedPlan as Record<string, unknown>).template)) {
    rawTemplate = (value.autosavedPlan as Record<string, unknown>).template as Record<string, unknown>;
  } else if (isRecord(value.semesters)) {
    rawTemplate = value;
  }

  if (!rawTemplate || !isRecord(rawTemplate.semesters)) {
    return null;
  }

  const templateName = typeof rawTemplate.name === 'string' && rawTemplate.name.trim()
    ? rawTemplate.name
    : 'תוכנית לימודים';
  const templateId = typeof rawTemplate.id === 'string' && rawTemplate.id.trim()
    ? rawTemplate.id
    : 'custom-plan';

  const semesters: Record<string, string[]> = {};
  for (const [semesterName, courseIds] of Object.entries(rawTemplate.semesters)) {
    if (!semesterName || !semesterName.trim()) continue;
    const validCourseIds = Array.isArray(courseIds)
      ? courseIds.filter((id): id is string => typeof id === 'string' && Boolean(id.trim()))
      : [];
    semesters[semesterName] = validCourseIds;
  }

  // Ensure Semester 0 is present
  if (!(SEMESTER_0_NAME in semesters)) {
    semesters[SEMESTER_0_NAME] = ['bonus_credits'];
  } else if (semesters[SEMESTER_0_NAME].length === 0) {
    semesters[SEMESTER_0_NAME] = ['bonus_credits'];
  }

  let parsedRules: DegreeRule[] | undefined = undefined;
  if (Array.isArray(rawTemplate.rules)) {
    parsedRules = rawTemplate.rules.map(normalizeImportedRule).filter((r): r is DegreeRule => r !== null);
  }

  const ruleTotalCredits = parsedRules?.find(r => r.type === 'total_credits')?.required_credits;
  const totalCredits = isNonNegativeFiniteNumber(rawTemplate.total_credits)
    ? rawTemplate.total_credits
    : isNonNegativeFiniteNumber(ruleTotalCredits)
    ? ruleTotalCredits
    : 0;

  const degreeTemplate: DegreeTemplate = {
    id: templateId,
    name: templateName,
    total_credits: totalCredits,
    semesters,
    ...(parsedRules && parsedRules.length > 0 ? { rules: parsedRules } : {}),
  };

  if (isRecord(rawTemplate['courses-lists'])) {
    const courseLists: Record<string, string[]> = {};
    for (const [listName, courseIds] of Object.entries(rawTemplate['courses-lists'])) {
      if (!listName.trim()) continue;
      const validCourseIds = Array.isArray(courseIds)
        ? courseIds.filter((id): id is string => typeof id === 'string')
        : [];
      courseLists[listName] = validCourseIds;
    }
    degreeTemplate['courses-lists'] = courseLists;
  }

  if (Array.isArray(rawTemplate['specialization-paths'])) {
    degreeTemplate['specialization-paths'] = rawTemplate['specialization-paths'] as DegreeTemplate['specialization-paths'];
  }

  if (Array.isArray(rawTemplate.definedMandatoryCourseIds)) {
    degreeTemplate.definedMandatoryCourseIds = rawTemplate.definedMandatoryCourseIds.filter((id): id is string => typeof id === 'string');
  }

  if (isRecord(rawTemplate['semester-names'])) {
    const semesterNames = getStringRecord(rawTemplate['semester-names']);
    if (semesterNames) degreeTemplate['semester-names'] = semesterNames;
  }

  const container = isRecord(value.autosavedPlan) ? (value.autosavedPlan as Record<string, unknown>) : value;
  const grades = getStringRecord(container.grades) || {};
  const classificationChecked = getBooleanRecord(container.classificationChecked) || {};
  const classificationCredits = getNumberRecord(container.classificationCredits) || {};
  const binaryStates = getBooleanRecord(container.binaryStates) || {};

  return {
    degreeTemplate,
    grades,
    classificationChecked,
    classificationCredits,
    binaryStates,
    exportDate: typeof value.exportDate === 'string' ? value.exportDate : undefined,
  };
};

const renameRuleListReferences = (rule: DegreeRule, renamedLists: Record<string, string>): DegreeRule => ({
  ...rule,
  ...(rule.course_list_name ? { course_list_name: renamedLists[rule.course_list_name] ?? rule.course_list_name } : {}),
  ...(rule.listName ? { listName: renamedLists[rule.listName] ?? rule.listName } : {}),
  ...(rule.lists ? {
    lists: rule.lists.map(item => ({ ...item, listName: renamedLists[item.listName] ?? item.listName })),
  } : {}),
  ...(rule.combinedRules ? {
    combinedRules: rule.combinedRules.map(item => ({
      ...item,
      selectedLists: item.selectedLists.map(listName => renamedLists[listName] ?? listName),
    })),
  } : {}),
});

const getReferencedCourseListNames = (rules: DegreeRule[] = []): string[] => [
  ...new Set(rules.flatMap(rule => [
    rule.course_list_name,
    rule.listName,
    ...rule.lists?.map(item => item.listName) ?? [],
    ...rule.combinedRules?.flatMap(item => item.selectedLists) ?? [],
  ].filter((listName): listName is string => Boolean(listName)))),
];

interface DegreePlanViewProps {
  allTemplatesData: Record<string, DegreeTemplate> | null;
}

interface CourseDetailModalData {
  course: RawCourseData;
  coursesInPlanIds: Set<string>;
}

interface CourseDetailModalDataWithSemesters extends CourseDetailModalData {
  semesters?: Record<string, string[]>;
  targetCourseSemesterKey?: string;
}

const initialClassificationCheckedState: Record<string, boolean> = {};

const transformDataToNodes = (
  template: DegreeTemplate | undefined,
  allCourses: RawCourseData[],
  currentGrades: Record<string, string>,
  currentBinaryStates: Record<string, boolean>,
  handleBinaryChange: (courseId: string, isBinary: boolean) => void,
  onAddCourseToSemesterCallback: (semesterNumber: number) => void,
  onAddSemesterCallbackParam: () => void,
  onGradeChangeCallback: (courseId: string, grade: string) => void,
  onRemoveCourseCallback: (courseId: string) => void,
  classificationCheckedState: Record<string, boolean>,
  onClassificationToggleCallback: (courseId: string) => void,
  classificationCreditsState: Record<string, number>,
  onClassificationCreditsChangeCallback: (courseId: string, credits: number) => void,
  globalRules: DegreeRule[],
  allTemplatesData: Record<string, DegreeTemplate> | null,
  onEditRuleCallback?: (ruleId: string) => void,
  onDeleteRuleCallback?: (ruleId: string) => void,
  onSyncRulesCallback?: (ruleId: string) => void,
  onEditCoursesCallback?: () => void,
  onRemoveSemesterCallback?: (semesterKey: string) => void,
  onBonusCreditsChangeCallback?: (credits: number) => void,
  onAddBonusCreditsCallback?: () => void,
  lockedSemestersState: Record<string, boolean> = {},
  onToggleLockCallback?: (semesterKey: string) => void
): Node[] => {
  // --- BEGIN MORE BASIC DEBUG LOG ---
  if (import.meta.env.DEV) {
    console.debug(
      '[transformDataToNodes] Entry. template.id:',
      template?.id,
      'allTemplatesData is null?:',
      allTemplatesData === null,
      'allTemplatesData keys:',
      allTemplatesData ? Object.keys(allTemplatesData) : 'N/A',
      'template.id in allTemplatesData?:',
      template && allTemplatesData ? !!allTemplatesData[template.id] : 'N/A'
    );
  }
  // --- END MORE BASIC DEBUG LOG ---

  // --- BEGIN DEBUG LOG ---
  if (import.meta.env.DEV && template && allTemplatesData && allTemplatesData[template.id]) {
    const pristineInTransform = allTemplatesData[template.id];
    if (pristineInTransform && pristineInTransform.semesters) {
        const mandatoryFromPristineInTransform = Object.values(pristineInTransform.semesters).flat();
        console.debug(`[transformDataToNodes] Checking allTemplatesData[${template.id}].semesters directly. Count:`, mandatoryFromPristineInTransform.length, mandatoryFromPristineInTransform);
    }
  }
  // --- END DEBUG LOG ---
  if (import.meta.env.DEV) {
    console.log('[transformDataToNodes] Function called. import.meta.env.DEV:', import.meta.env.DEV);
  }

  if (!template || typeof template.semesters !== 'object' || template.semesters === null) {
    if (template && (typeof template.semesters !== 'object' || template.semesters === null)) {
      console.warn('Data Structure Warning (transformDataToNodes): template.semesters is not an object!', template.semesters);
    }
    return [];
  }

  const flowNodes: Node[] = [];
  let currentContentY = VERTICAL_SPACING_RULE;
  let maxEstimatedRuleHeight = 460; // Top summary row height (Weekly Hours + Averages cards)
  const ruleRowStartY = currentContentY;

  const bonusPts = typeof classificationCreditsState['bonus_credits'] === 'number'
    ? classificationCreditsState['bonus_credits']
    : 0;

  const effectiveAllCourses = Array.isArray(allCourses) ? [
    ...allCourses.filter(c => c._id !== 'bonus_credits'),
    {
      _id: 'bonus_credits',
      name: 'בונוסים',
      credits: bonusPts,
      hours: '',
      prereqTree: null,
      semesters: [],
      isClassificationCourse: false,
    } as RawCourseData
  ] : [];

  const allCourseIdsInTemplate = Object.values(template.semesters).flat();
  const coursesInCurrentPlan = (Array.isArray(effectiveAllCourses) ? allCourseIdsInTemplate
    .map(courseId => effectiveAllCourses.find(c => c._id === courseId))
    .filter(Boolean) : []) as RawCourseData[];

  // Sort semesters in canonical order: Semester 0, Semester א', Semester ב', etc.
  const semesterEntries = sortSemesterEntries(Object.entries(template.semesters));
  if (import.meta.env.DEV) {
    console.debug('[DEBUG transformDataToNodes] Semester entries order:', semesterEntries.map(e => e[0]));
  }
  const numExistingSemesters = semesterEntries.length;
  const maxSemesterNum = numExistingSemesters > 0 ? Math.max(...semesterEntries.map((_, i) => i + 1)) : 0;
  const addSemesterNodeIsVisible = numExistingSemesters < MAX_SEMESTERS;
  const baseSemesterAreaStartX = addSemesterNodeIsVisible ? COLUMN_WIDTH + HORIZONTAL_SPACING_SEMESTER : 0;
  const firstSemesterXPos = baseSemesterAreaStartX + (maxSemesterNum > 0 ? (maxSemesterNum - 1) : 0) * (COLUMN_WIDTH + HORIZONTAL_SPACING_SEMESTER);

  const ruleNodeBaseXAdjustment = 98;
  
  // Hard-coded rule positioning constants with width information
  const RULE_POSITIONS = {
    CONSOLIDATED: { order: 0, width: 400 },        // התקדמות אקדמית כללית - leftmost position, wider
    SELECTIVE_LISTS: { order: 1, width: 340 },     // קורסים מרשימות בחירה
    COMBINED_SELECTIVE: { order: 2, width: 400 },  // דרישות מרוכבות מרשימות בחירה - wider
    CLASSIFICATION: { order: 3, width: 340 },      // פטורים - rightmost position
  } as const;

  // Check what rule types exist first
  let globalHasClassificationRule = false;
  let templateHasConsolidatedGroup = false;
  
  if (Array.isArray(globalRules)) {
    if (globalRules.some(rule => rule.type === 'classification_courses')) {
      globalHasClassificationRule = true;
    }
  }

  if (template.rules && Array.isArray(template.rules)) {
    const consolidatedRuleTypes = new Set([
      'total_credits', 'credits_from_list', 'min_grade', 'minCredits',
      'minCoursesFromList', 'minCreditsFromMandatory', 'minCreditsFromAnySelectiveList', 'minCreditsFromIdPattern'
    ]);
    templateHasConsolidatedGroup = template.rules.some(rule => 
      rule && consolidatedRuleTypes.has(rule.type)
    );
  }

  if (import.meta.env.DEV) {
    console.debug('[Rule Detection] globalHasClassificationRule:', globalHasClassificationRule);
    console.debug('[Rule Detection] templateHasConsolidatedGroup:', templateHasConsolidatedGroup);
    console.debug('[Rule Detection] template.rules:', template.rules?.map(r => ({ id: r.id, type: r.type, description: r.description })));
    console.debug('[Rule Detection] globalRules:', globalRules?.map(r => ({ id: r.id, type: r.type })));
  }

  // Helper function to determine what rules exist and their actual order and widths
  const getActualRuleLayout = () => {
    const ruleLayout: Array<{ order: number; width: number; key: string }> = [];
    
    // Add consolidated rule if it exists
    if (templateHasConsolidatedGroup) {
      ruleLayout.push({ order: 0, width: 400, key: 'consolidated' });
    }
    
    // Check for selective lists rules
    const hasSelectiveListsRule = template.rules?.some(rule => 
      rule.description?.includes('קורסים מרשימות בחירה') || rule.type === 'minCoursesFromMultipleLists'
    );
    if (hasSelectiveListsRule) {
      ruleLayout.push({ order: 1, width: 340, key: 'selective' });
    }
    
    // Check for combined selective rules
    const hasCombinedSelectiveRule = template.rules?.some(rule => 
      rule.description?.includes('דרישות מרוכבות') || rule.type === 'minCreditsFromSelectedLists'
    );
    if (hasCombinedSelectiveRule) {
      ruleLayout.push({ order: 2, width: 400, key: 'combined' });
    }
    
    // Add classification rule if it exists
    if (globalHasClassificationRule) {
      ruleLayout.push({ order: 3, width: 340, key: 'classification' });
    }
    
    const sortedLayout = ruleLayout.sort((a, b) => a.order - b.order);
    
    if (import.meta.env.DEV) {
      console.debug(`[getActualRuleLayout] Detected rules:`, sortedLayout);
    }
    
    return sortedLayout;
  };

  // Helper function to calculate where each rule's LEFT edge should be positioned
  const calculateRulePosition = (ruleOrder: number): number => {
    const actualRules = getActualRuleLayout();
    
    if (import.meta.env.DEV) {
      console.debug(`[calculateRulePosition] For order ${ruleOrder}, actualRules:`, actualRules);
    }
    
    // Calculate position by working backwards from the right
    const currentRule = actualRules.find(r => r.order === ruleOrder);
    if (!currentRule) {
      if (import.meta.env.DEV) {
        console.debug(`[calculateRulePosition] Rule not found for order ${ruleOrder}`);
      }
      return 0;
    }
    
    // Start from the base position and work leftward
    let rightEdgePosition = 0; // This will be relative to the base position
    
    // Calculate where this rule's right edge should be
    for (const ruleInfo of actualRules) {
      if (ruleInfo.order < ruleOrder) {
        rightEdgePosition -= ruleInfo.width + HORIZONTAL_SPACING_RULE_GROUPS;
        if (import.meta.env.DEV) {
          console.debug(`[calculateRulePosition] Rule ${ruleInfo.key} pushes right edge left by ${ruleInfo.width + HORIZONTAL_SPACING_RULE_GROUPS}, now at: ${rightEdgePosition}`);
        }
      }
    }
    
    // The left edge is the right edge minus this rule's width
    const leftEdgeOffset = rightEdgePosition - currentRule.width;
    
    if (import.meta.env.DEV) {
      console.debug(`[calculateRulePosition] Rule ${currentRule.key}: right edge at ${rightEdgePosition}, left edge at ${leftEdgeOffset} (width: ${currentRule.width})`);
    }
    
    // Return the absolute offset from the base position
    return Math.abs(leftEdgeOffset);
  };

  // Debug summary of expected rule bounds
  if (import.meta.env.DEV) {
    const allRuleLayout = getActualRuleLayout();
    console.debug('\n=== EXPECTED RULE BOUNDS SUMMARY ===');
    allRuleLayout.forEach(rule => {
      const offset = calculateRulePosition(rule.order);
      const baseX = firstSemesterXPos - ruleNodeBaseXAdjustment;
      const finalX = baseX - offset;
      console.debug(`${rule.key.toUpperCase()} (order ${rule.order}): x=${finalX}, bounds=[${finalX} to ${finalX + rule.width}], width=${rule.width}px`);
    });
    console.debug('=== END SUMMARY ===\n');
  }

  // Add edit courses button node above rules, aligned to the right of "קורסים מרשימות בחירה" rule
  if (onEditCoursesCallback) {
    // Hard-coded position for selective lists rule
    const targetRuleXOffset = calculateRulePosition(RULE_POSITIONS.SELECTIVE_LISTS.order);
    const targetRuleX = (firstSemesterXPos - ruleNodeBaseXAdjustment) - targetRuleXOffset;
    const targetRuleRightEdge = targetRuleX + RULE_POSITIONS.SELECTIVE_LISTS.width;
    const editButtonWidth = 200; // min-w-[200px] from EditCoursesNode
    const editButtonX = targetRuleRightEdge - editButtonWidth; // Align right edges
    
    if (import.meta.env.DEV) {
      console.log(`[transformDataToNodes] Edit button aligned with selective lists rule at position: ${RULE_POSITIONS.SELECTIVE_LISTS.order}`);
    }
    
    flowNodes.push({
      id: 'edit-courses-button',
      type: 'editCourses',
      position: { x: editButtonX, y: ruleRowStartY - 80 },
      data: { onEditCourses: onEditCoursesCallback },
      draggable: false,
      selectable: false,
    });
  }

  if (globalHasClassificationRule) {
    const classificationRule = globalRules.find(rule => rule.type === 'classification_courses');
    if (classificationRule && classificationRule.courses) {
      const nodeId = `${GLOBAL_RULES_NODE_ID_PREFIX}${classificationRule.id}`;
      const xOffsetFactor = calculateRulePosition(RULE_POSITIONS.CLASSIFICATION.order);
      const nodePosition = { x: (firstSemesterXPos - ruleNodeBaseXAdjustment) - xOffsetFactor, y: ruleRowStartY };
      
      if (import.meta.env.DEV) {
        console.debug('[Classification Rule] xOffsetFactor:', xOffsetFactor);
        console.debug('[Classification Rule] firstSemesterXPos:', firstSemesterXPos);
        console.debug('[Classification Rule] ruleNodeBaseXAdjustment:', ruleNodeBaseXAdjustment);
        console.debug('[Classification Rule] Final position:', nodePosition);
        console.debug('[Classification Rule] Expected bounds: left=' + nodePosition.x + ' right=' + (nodePosition.x + 340));
      }

      const detailsForNode = classificationRule.courses.map(course => ({
        id: course.id,
        name: course.name,
        checked: classificationCheckedState[course.id] || false,
        credits: classificationCreditsState[course.id],
        creditInput: course.creditInput,
      }));

      const estimatedHeightClassification = 70 + (detailsForNode.length * 35);
      maxEstimatedRuleHeight = Math.max(maxEstimatedRuleHeight, estimatedHeightClassification);

      const classificationNodeData: RuleNodeData = {
        id: classificationRule.id,
        description: "פטורים",
        currentProgress: "בחר פטורים שהושלמו",
        isSatisfied: false,
        classificationCourseDetails: detailsForNode,
        onClassificationToggle: onClassificationToggleCallback,
        onClassificationCreditsChange: onClassificationCreditsChangeCallback,
      };
      flowNodes.push({
        id: nodeId,
        type: 'rule',
        position: nodePosition,
        data: classificationNodeData,
      });
    }
  }

  const otherRules = (template.rules || []).filter(rule => {
    const consolidatedRuleTypes = new Set([
      'total_credits', 'credits_from_list', 'min_grade', 'minCredits',
      'minCoursesFromList', 'minCreditsFromMandatory', 'minCreditsFromAnySelectiveList', 'minCreditsFromIdPattern'
    ]);
    return rule.type !== 'classification_courses' && !consolidatedRuleTypes.has(rule.type) && rule.id && rule.description;
  });

  let effectiveMandatoryCourseIds: string[] | undefined = undefined;
  if (template) {
    effectiveMandatoryCourseIds = template.definedMandatoryCourseIds;
    if (import.meta.env.DEV) {
      console.debug('[transformDataToNodes] Using template.definedMandatoryCourseIds for effectiveMandatoryCourseIds:', effectiveMandatoryCourseIds);
    }
    if (effectiveMandatoryCourseIds === undefined) {
        effectiveMandatoryCourseIds = [];
        if (import.meta.env.DEV) {
            console.warn('[transformDataToNodes] effectiveMandatoryCourseIds was undefined, defaulting to empty array.');
        }
    }
  } else {
    if (import.meta.env.DEV) {
      console.warn('[transformDataToNodes] Template is undefined. effectiveMandatoryCourseIds will be empty array.');
    }
    effectiveMandatoryCourseIds = [];
  }

  // Helper function to determine rule position based on type and description
  const getRulePosition = (rule: DegreeRule): number => {
    // Check by description patterns first (more specific)
    if (rule.description?.includes('קורסים מרשימות בחירה') || rule.type === 'minCoursesFromMultipleLists') {
      return calculateRulePosition(RULE_POSITIONS.SELECTIVE_LISTS.order);
    }
    if (rule.description?.includes('דרישות מרוכבות') || rule.type === 'minCreditsFromSelectedLists') {
      return calculateRulePosition(RULE_POSITIONS.COMBINED_SELECTIVE.order);
    }
    
    // Default position for unrecognized rules - use a consistent order beyond classification
    const defaultOrder = 4; // Place after classification (order 3)
    return calculateRulePosition(defaultOrder);
  };

  otherRules.forEach((rule) => {
    const ruleStatus = evaluateRule(
      rule, coursesInCurrentPlan, currentGrades, 
      currentBinaryStates,
      template["courses-lists"], 
      effectiveMandatoryCourseIds,
      classificationCheckedState, 
      classificationCreditsState
    );
    const nodeId = `rule-${rule.id}`;
    
    let estimatedHeight = 120; 
    if (rule.type === 'minCoursesFromMultipleLists' && rule.lists) {
      estimatedHeight = 70 + (rule.lists.length * 50); 
    } else if (rule.type === 'minCreditsFromSelectedLists' && rule.combinedRules) {
      estimatedHeight = 70 + (rule.combinedRules.length * 35); // Slightly smaller since it's just a list display
    }
    maxEstimatedRuleHeight = Math.max(maxEstimatedRuleHeight, estimatedHeight);

    const xOffsetFactor = getRulePosition(rule);
    
    if (import.meta.env.DEV) {
      const finalX = (firstSemesterXPos - ruleNodeBaseXAdjustment) - xOffsetFactor;
      const nodeWidth = rule.type === 'minCreditsFromSelectedLists' ? 400 : 340;
      console.debug(`[Other Rule - ${rule.type}] Rule:`, { id: rule.id, type: rule.type, description: rule.description });
      console.debug(`[Other Rule - ${rule.type}] xOffsetFactor:`, xOffsetFactor);
      console.debug(`[Other Rule - ${rule.type}] Final position:`, { x: finalX, y: ruleRowStartY });
      console.debug(`[Other Rule - ${rule.type}] Expected bounds: left=${finalX} right=${finalX + nodeWidth} width=${nodeWidth}`);
    }
    
    const ruleNodeData: RuleNodeData = {
      id: rule.id,
      description: rule.description || "כלל ללא תיאור",
      type: rule.type,
      currentProgress: ruleStatus.currentProgressString,
      targetProgress: ruleStatus.requiredValue,
      isSatisfied: ruleStatus.isSatisfied,
      listName: rule.listName || rule.course_list_name,
      minGrade: rule.min_grade_value,
      minCourses: (rule.type === 'minCoursesFromList' || rule.type === 'minCoursesFromMultipleLists') ? rule.min : undefined,
      minCredits: (rule.type === 'credits_from_list' || rule.type === 'minCredits' || rule.type === 'minCreditsFromMandatory' || rule.type === 'minCreditsFromAnySelectiveList' || rule.type === 'total_credits' || rule.type === 'minCreditsFromSelectedLists') ? (rule.min ?? rule.required_credits) : undefined,
      listProgressDetails: ruleStatus.listProgressDetails ?? undefined,
      onEditRule: () => onEditRuleCallback?.(rule.id),
      onDeleteRule: () => onDeleteRuleCallback?.(rule.id),
      onSyncRules: () => onSyncRulesCallback?.(rule.id),
    };

    flowNodes.push({
      id: nodeId,
      type: 'rule',
      position: { 
        x: (firstSemesterXPos - ruleNodeBaseXAdjustment) - xOffsetFactor, 
        y: ruleRowStartY 
      },
      data: ruleNodeData,
    });
  });

  if (templateHasConsolidatedGroup) {
    const rulesToConsolidate = (template.rules || []).filter(rule => {
      const consolidatedRuleTypes = new Set([
        'total_credits', 'credits_from_list', 'min_grade', 'minCredits',
        'minCoursesFromList', 'minCreditsFromMandatory', 'minCreditsFromAnySelectiveList', 'minCreditsFromIdPattern'
      ]);
      return rule.type !== 'classification_courses' && consolidatedRuleTypes.has(rule.type);
    });

    if (rulesToConsolidate.length > 0) {
      const consolidatedNodeId = CONSOLIDATED_RULES_NODE_ID;
      const consolidatedRuleDetails: RuleNodeData['consolidatedRules'] = [];
      let allConsolidatedSatisfied = true;

      rulesToConsolidate.forEach(rule => {
        const ruleStatus = evaluateRule(
          rule, coursesInCurrentPlan, currentGrades, 
          currentBinaryStates,
          template["courses-lists"], 
          effectiveMandatoryCourseIds,
          classificationCheckedState, 
          classificationCreditsState
        );
        consolidatedRuleDetails.push({
          id: rule.id,
          description: rule.description || `חוק ${rule.type}`,
          currentProgress: ruleStatus.currentProgressString,
          isSatisfied: ruleStatus.isSatisfied,
          currentValuePlanned: ruleStatus.currentValuePlanned ?? undefined,
          currentValueDone: ruleStatus.currentValueDone ?? undefined,
          requiredValue: ruleStatus.requiredValue ?? undefined,
        });
        if (!ruleStatus.isSatisfied) {
          allConsolidatedSatisfied = false;
        }
      });
      
      const estimatedHeightConsolidated = 90 + consolidatedRuleDetails.length * 60; // Increased from 60 to 90 to account for legend on separate line
      maxEstimatedRuleHeight = Math.max(maxEstimatedRuleHeight, estimatedHeightConsolidated);

      const xOffsetFactor = calculateRulePosition(RULE_POSITIONS.CONSOLIDATED.order);
      
      if (import.meta.env.DEV) {
        const finalX = (firstSemesterXPos - ruleNodeBaseXAdjustment) - xOffsetFactor;
        console.debug('[Consolidated Rule] xOffsetFactor:', xOffsetFactor);
        console.debug('[Consolidated Rule] firstSemesterXPos:', firstSemesterXPos);
        console.debug('[Consolidated Rule] ruleNodeBaseXAdjustment:', ruleNodeBaseXAdjustment);
        console.debug('[Consolidated Rule] Final position:', { x: finalX, y: ruleRowStartY });
        console.debug('[Consolidated Rule] Expected bounds: left=' + finalX + ' right=' + (finalX + 400));
      }
      
      const consolidatedNodeData: RuleNodeData = {
        id: consolidatedNodeId,
        description: "התקדמות אקדמית כללית",
        type: "consolidated",
        isSatisfied: allConsolidatedSatisfied,
        currentProgress: `${consolidatedRuleDetails.filter(r => r.isSatisfied).length} / ${consolidatedRuleDetails.length} תתי-כללים הושלמו`,
        targetProgress: consolidatedRuleDetails.length,
        isConsolidated: true,
        consolidatedRules: consolidatedRuleDetails,
        onEditRule: onEditRuleCallback,
        onDeleteRule: onDeleteRuleCallback,
        onSyncRules: onSyncRulesCallback,
      };
      const consolidatedX = (firstSemesterXPos - ruleNodeBaseXAdjustment) - xOffsetFactor;
      flowNodes.push({
        id: consolidatedNodeId,
        type: 'rule',
        position: { x: consolidatedX, y: ruleRowStartY },
        data: consolidatedNodeData,
      });
    }
  }

  // Weekly hours summary: placed between General Progress (Consolidated rules) and Averages summary,
  // directly above Semester 1 (at firstSemesterXPos), top-aligned with the rule row.
  flowNodes.push({
    id: 'weekly-hours-summary-node',
    type: 'weeklyHours',
    position: { x: firstSemesterXPos, y: ruleRowStartY },
    data: {
      currentTemplate: template,
      allCourses: effectiveAllCourses,
    },
    draggable: false,
    selectable: false,
  });

  // Averages & credits summary: placed to the RIGHT of Semester 1's column, top-aligned with the rule row.
  // It grows vertically with the number of semesters (no inner scrollbar).
  flowNodes.push({
    id: 'averages-summary-node',
    type: 'averages',
    position: { x: firstSemesterXPos + COLUMN_WIDTH, y: ruleRowStartY },
    data: {
      currentTemplate: template,
      allCourses: effectiveAllCourses,
      grades: currentGrades,
    },
    draggable: false,
    selectable: false,
  });

  currentContentY = ruleRowStartY + maxEstimatedRuleHeight + SEMESTER_TOP_MARGIN;

  // Calculate tabIndex for keyboard navigation through grade inputs
  let globalTabIndex = 1;

  semesterEntries.forEach(([semesterName, courseIds], semesterIndex) => {
    const semesterNumberForLayout = semesterIndex + 1;
    const semesterXPos = baseSemesterAreaStartX + (maxSemesterNum - semesterNumberForLayout) * (COLUMN_WIDTH + HORIZONTAL_SPACING_SEMESTER);
    const isLocked = Boolean(lockedSemestersState[semesterName]);

    flowNodes.push({
      id: `title-sem-${semesterNumberForLayout}`,
      type: 'semesterTitle',
      position: { x: semesterXPos, y: currentContentY },
      data: { 
        title: semesterName,
        semesterKey: semesterName,
        isEmpty: courseIds.length === 0,
        isLocked,
        onToggleLock: onToggleLockCallback,
        onRemoveSemester: onRemoveSemesterCallback,
        onAddBonusCredits: onAddBonusCreditsCallback,
        hasBonusCourse: courseIds.includes('bonus_credits'),
      },
      draggable: false,
      selectable: false,
    });

    let currentYInSemester = currentContentY + SEMESTER_TITLE_HEIGHT;

    courseIds.forEach((courseId) => {
      try {
        if (typeof courseId !== 'string' || !courseId) {
          console.warn(`[transformDataToNodes] Skipping invalid courseId: ${courseId} in semesterIndex ${semesterIndex}`);
          return;
        }

        const foundCourse = effectiveAllCourses.find(c => c._id === courseId || c._id === courseId.replace(/^0+/, '') || ('0' + c._id) === courseId);
        const courseData: RawCourseData = foundCourse || {
          _id: courseId,
          name: courseId === 'bonus_credits' ? 'בונוסים' : `קורס ${courseId}`,
          credits: 0,
          hours: '',
          prereqTree: null,
          semesters: [],
          isClassificationCourse: false,
        };

        if (import.meta.env.DEV) {
          console.debug(`[transformDataToNodes] Checking prerequisites for course: ${courseData._id} (${courseData.name}) in semester ${semesterNumberForLayout}. Inputs:`, {
            courseData,
            semesterNumberForLayout,
            semesters: template.semesters,
            classificationCheckedState
          });
        }

        const prereqStatusResult: PrereqStatus = checkPrerequisites(
          courseData, 
          semesterNumberForLayout, 
          template.semesters, 
          effectiveAllCourses,
          classificationCheckedState
        );

        if (import.meta.env.DEV) {
          console.debug(`[transformDataToNodes] Prereq status for ${courseData._id}: ${prereqStatusResult}`);
        }

        const nodeId = courseId;
        const nodePosition = { x: semesterXPos, y: currentYInSemester };

        const hoursBreakdown = parseCourseHours(courseData.hours, courseData._id, courseData.name);
        const earliestResult = calculateEarliestSemester(
          courseId,
          effectiveAllCourses,
          template.semesters,
          classificationCheckedState,
          lockedSemestersState
        );

        const semesterOrder = getSemesterOrderIndex(semesterName);
        const academicSemesterNumber = (semesterOrder >= 0 && semesterOrder < 999) ? semesterOrder : semesterNumberForLayout;

        const seasonMismatchInfo = checkSeasonMismatch(
          courseData.semesters || courseData.semester,
          academicSemesterNumber
        );
        
        const courseNodeData: CourseNodeData = {
          label: courseData.name || courseId,
          courseId: courseData._id,
          credits: courseId === 'bonus_credits' ? bonusPts : (courseData.credits !== undefined ? courseData.credits : 'N/A'),
          weeklyHours: hoursBreakdown.total,
          weeklyHoursStr: courseData.hours,
          earliestSemesterLetter: earliestResult.semesterLetter,
          earliestSemesterNumber: earliestResult.semesterNumber,
          grade: currentGrades[courseId] || '',
          onGradeChange: onGradeChangeCallback,
          onRemoveCourse: onRemoveCourseCallback,
          prerequisitesMet: prereqStatusResult,
          isBinary: currentBinaryStates[courseId] || false,
          onBinaryChange: handleBinaryChange,
          tabIndex: globalTabIndex++,
          offeredSemesters: (courseData.semesters || courseData.semester) as string[] | undefined,
          onBonusCreditsChange: onBonusCreditsChangeCallback,
          seasonMismatch: seasonMismatchInfo.hasMismatch,
          seasonMismatchMessage: seasonMismatchInfo.message,
          isSemesterLocked: isLocked,
        };

        flowNodes.push({
          id: nodeId,
          type: 'course',
          position: nodePosition,
          data: courseNodeData,
        });
        currentYInSemester += NODE_HEIGHT_COURSE + VERTICAL_SPACING_RULE;
      } catch (err) {
        console.error(`[transformDataToNodes] Error processing course ${courseId}:`, err);
      }
    });

    // Only allow adding courses if the semester is not locked
    if (!isLocked) {
      flowNodes.push({
        id: `add-course-sem-${semesterNumberForLayout}`,
        type: 'addCourse',
        position: { x: semesterXPos, y: currentYInSemester },
        data: {
          semesterNumber: semesterNumberForLayout,
          onAddCourse: onAddCourseToSemesterCallback,
        },
        draggable: false,
      });
    }
  });

  if (numExistingSemesters < MAX_SEMESTERS) {
    flowNodes.push({
      id: ADD_SEMESTER_NODE_ID,
      type: 'addSemester',
      position: { x: HORIZONTAL_SPACING_SEMESTER / 2, y: currentContentY + SEMESTER_TITLE_HEIGHT },
      data: { onAddSemester: onAddSemesterCallbackParam },
      draggable: false,
    });
  }

  // Set content Y position after rules
  currentContentY = ruleRowStartY + maxEstimatedRuleHeight + SEMESTER_TOP_MARGIN;

  return flowNodes;
};

const transformDataToEdges = (
  template: DegreeTemplate | undefined,
  allCourses: RawCourseData[]
): Edge[] => {
  if (import.meta.env.DEV) {
    console.log('[transformDataToEdges] Starting. Template defined:', !!template, 'AllCourses count:', Array.isArray(allCourses) ? allCourses.length : 'N/A');
  }
  if (!template || typeof template.semesters !== 'object' || template.semesters === null || !Array.isArray(allCourses)) {
    if (template && (typeof template.semesters !== 'object' || template.semesters === null)) {
      console.warn('Data Structure Warning (transformDataToEdges): template.semesters is not an object!', template.semesters);
    }
    if (!Array.isArray(allCourses)) {
      console.warn('Data Input Warning (transformDataToEdges): allCourses is not an array!', allCourses);
    }
    return [];
  }

  const edges: Edge[] = [];
  const edgeIdSet = new Set<string>();
  const allCourseIdsInPlan = Object.values(template.semesters).flat();
  if (import.meta.env.DEV) {
    console.log('[transformDataToEdges] All course IDs in current plan:', allCourseIdsInPlan);
  }

  const resolvePrereqInPlan = (prereqId: string, targetCourseId: string): string | null => {
    if (allCourseIdsInPlan.includes(prereqId) && prereqId !== targetCourseId) {
      return prereqId;
    }
    // Check if an equivalent course is in the plan
    for (const placedId of allCourseIdsInPlan) {
      if (placedId === targetCourseId) continue;
      const eqSet = getEquivalentCourses(placedId, allCourses);
      if (eqSet.has(prereqId)) {
        return placedId;
      }
    }
    return null;
  };

  allCourseIdsInPlan.forEach(courseId => {
    const course = allCourses.find(c => c._id === courseId);
    if (course && course.prereqTree) {
      const processPrerequisites = (prereq: PrerequisiteItem | PrerequisiteGroup | { or?: (PrerequisiteItem | PrerequisiteGroup)[], and?: (PrerequisiteItem | PrerequisiteGroup)[] }, targetCourseId: string) => {
        if (typeof prereq === 'string') {
          const resolvedSourceId = resolvePrereqInPlan(prereq, targetCourseId);
          if (resolvedSourceId) {
            const edgeId = `edge-${resolvedSourceId}-${targetCourseId}`;
            if (!edgeIdSet.has(edgeId)) {
              edges.push({
                id: edgeId,
                source: resolvedSourceId,
                target: targetCourseId,
                type: 'default',
                markerEnd: { type: MarkerType.ArrowClosed, color: '#cccccc' },
                animated: false,
                style: { stroke: '#cccccc', strokeWidth: 1.5, strokeOpacity: 0.2 },
              });
              edgeIdSet.add(edgeId);
            }
          }
        } else if (prereq && typeof prereq === 'object') {
          let itemsToProcess: (PrerequisiteItem | PrerequisiteGroup)[] = [];
          if (Array.isArray((prereq as { or?: [] }).or)) {
            itemsToProcess = (prereq as { or: [] }).or;
          } else if (Array.isArray((prereq as { and?: [] }).and)) {
            itemsToProcess = (prereq as { and: [] }).and;
          } else if (Array.isArray((prereq as PrerequisiteGroup).list)) {
            itemsToProcess = (prereq as PrerequisiteGroup).list;
          }
          if (itemsToProcess.length > 0) {
            itemsToProcess.forEach(item => processPrerequisites(item, targetCourseId));
          }
        }
      };
      processPrerequisites(course.prereqTree, courseId);
    }
  });
  if (import.meta.env.DEV) {
    console.log('[transformDataToEdges] Finished. Total edges generated:', edges.length);
  }
  return edges;
};

function DegreePlanView({ allTemplatesData }: DegreePlanViewProps) {
  const { theme } = useTheme();
  const { currentUser, loading: authLoading, signInWithGoogle, signOut } = useAuth();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [binaryStates, setBinaryStates] = useState<Record<string, boolean>>({});
  const [allCoursesData, setAllCoursesData] = useState<RawCourseData[]>([]);
  const [degreeTemplate, setDegreeTemplate] = useState<DegreeTemplate | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [semesterToAddCourseTo, setSemesterToAddCourseTo] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [courseDetailModalData, setCourseDetailModalData] = useState<CourseDetailModalDataWithSemesters | null>(null);
  const [editingRule, setEditingRule] = useState<DegreeRule | null>(null);
  const [isRuleEditorOpen, setIsRuleEditorOpen] = useState(false);
  const [isCourseListEditorOpen, setIsCourseListEditorOpen] = useState(false);
  const [isConsolidatedRuleEditorOpen, setIsConsolidatedRuleEditorOpen] = useState(false);
  const [selectedNodes, setSelectedNodes] = useState<Node[]>([]);
  const [pendingHighlightCourseId, setPendingHighlightCourseId] = useState<string | null>(null);
  const [rulesForConsolidatedEditing, setRulesForConsolidatedEditing] = useState<DegreeRule[]>([]);
  const [currentGlobalRules, setCurrentGlobalRules] = useState<DegreeRule[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
  const [hasUserMadeChanges, setHasUserMadeChanges] = useState<boolean>(false);
  const autosaveTimeoutRef = useRef<number | null>(null);
  const classificationCreditsDebounceTimeoutRef = useRef<number | null>(null);

  const [classificationChecked, setClassificationChecked] = useState<Record<string, boolean>>(initialClassificationCheckedState);
  const [classificationCredits, setClassificationCredits] = useState<Record<string, number>>({});
  const [lockedSemesters, setLockedSemesters] = useState<Record<string, boolean>>({});
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  const [showTemplateSelection, setShowTemplateSelection] = useState(false);
  const [isSwitchingTemplate, setIsSwitchingTemplate] = useState(false);
  const [showSwitchConfirm, setShowSwitchConfirm] = useState(false);
  const [showSignInConfirm, setShowSignInConfirm] = useState(false);
  const [showResetPlanConfirm, setShowResetPlanConfirm] = useState(false);
  const [isPlanSlotsModalOpen, setIsPlanSlotsModalOpen] = useState(false);
  const [isExportMapModalOpen, setIsExportMapModalOpen] = useState(false);
  const [activeSlotId, setActiveSlotIdState] = useState<string>(() => getActiveSlotId());

  const [showDeleteSemesterConfirm, setShowDeleteSemesterConfirm] = useState(false);
  const [semesterToDelete, setSemesterToDelete] = useState<string | null>(null);

  const [showAlert, setShowAlert] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title?: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    buttonText?: string;
  }>({ message: '' });

  const [showDeleteRuleConfirm, setShowDeleteRuleConfirm] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<string | null>(null);

  const [showSyncRulesConfirm, setShowSyncRulesConfirm] = useState(false);
  const [showSyncTemplateSelection, setShowSyncTemplateSelection] = useState(false);
  const [selectedSyncTemplate, setSelectedSyncTemplate] = useState<DegreeTemplate | null>(null);

  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [importData, setImportData] = useState<{
    degreeTemplate?: DegreeTemplate;
    grades?: Record<string, string>;
    classificationChecked?: Record<string, boolean>;
    classificationCredits?: Record<string, number>;
    binaryStates?: Record<string, boolean>;
    exportDate?: string;
  } | null>(null);

  const handleClassificationToggle = useCallback((courseId: string, isSelected?: boolean) => {
    setClassificationChecked(prev => {
      const current = Boolean(prev[courseId]);
      const nextVal = typeof isSelected === 'boolean' ? isSelected : !current;
      const newState = { ...prev, [courseId]: nextVal };
      if ((courseId === 'miluim_exemption' || courseId === 'general_exemption') && !newState[courseId]) {
        setClassificationCredits(creditPrev => ({ ...creditPrev, [courseId]: 0 }));
      }
      return newState;
    });
    setHasUserMadeChanges(true);
  }, []);

  const handleToggleSemesterLock = useCallback((semesterKey: string) => {
    setLockedSemesters(prev => {
      const next = { ...prev, [semesterKey]: !prev[semesterKey] };
      return next;
    });
    setHasUserMadeChanges(true);
  }, []);

  const handleBonusCreditsChange = useCallback((newCredits: number) => {
    const rounded = Math.max(0, Math.floor(newCredits * 2) / 2);
    setClassificationCredits(prev => ({ ...prev, bonus_credits: rounded }));
    setHasUserMadeChanges(true);
  }, []);

  const handleAddBonusCourseToSemester0 = useCallback(() => {
    setDegreeTemplate(prev => {
      if (!prev || typeof prev.semesters !== 'object') return prev;
      const updatedSemesters = { ...prev.semesters };
      const sem0Courses = updatedSemesters[SEMESTER_0_NAME] || [];
      if (!sem0Courses.includes('bonus_credits')) {
        updatedSemesters[SEMESTER_0_NAME] = [...sem0Courses, 'bonus_credits'];
      }
      return { ...prev, semesters: updatedSemesters };
    });
    setClassificationCredits(prev => ({
      ...prev,
      bonus_credits: typeof prev.bonus_credits === 'number' ? prev.bonus_credits : 2.5,
    }));
    setHasUserMadeChanges(true);
  }, []);

  const handleClassificationCreditsChange = useCallback((courseId: string, credits: number) => {
    if (classificationCreditsDebounceTimeoutRef.current) {
      clearTimeout(classificationCreditsDebounceTimeoutRef.current);
    }

    classificationCreditsDebounceTimeoutRef.current = window.setTimeout(() => {
      setClassificationCredits(prev => ({ ...prev, [courseId]: credits }));
    }, 100);
  }, []);

  const coursesInPlanFlatIds = useMemo(() => {
    if (!degreeTemplate || !degreeTemplate.semesters) return new Set<string>();
    return new Set(Object.values(degreeTemplate.semesters).flat().filter(id => typeof id === 'string')) as Set<string>;
  }, [degreeTemplate]);

  const handleAddCourseToSemesterCallback = useCallback((semesterNumber: number) => {
    if (import.meta.env.DEV) {
      console.log(`DegreePlanView: Request to add course to semester: ${semesterNumber}`);
    }
    setSemesterToAddCourseTo(semesterNumber);
    setIsModalOpen(true);
  }, []);

  const handleAddSemesterCallback = useCallback(() => {
    if (import.meta.env.DEV) {
      console.log('DegreePlanView: Add new semester');
    }
    setSelectedNodes([]); // Clear selection to prevent dimming new layout
    setHasUserMadeChanges(true);
    setDegreeTemplate(prevTemplate => {
      if (!prevTemplate || typeof prevTemplate.semesters !== 'object') return prevTemplate;
      const semesterKeys = Object.keys(prevTemplate.semesters);
      if (semesterKeys.length >= MAX_SEMESTERS) return prevTemplate;

      const hebrewSemestersCount = semesterKeys.filter(k => !k.includes('0')).length;
      const nextSemesterNum = hebrewSemestersCount + 1;
      const nextSemesterName = `סמסטר ${numberToHebrewLetter(nextSemesterNum)}`;

      return {
        ...prevTemplate,
        semesters: {
          ...prevTemplate.semesters,
          [nextSemesterName]: []
        }
      };
    });
  }, []);

  const handleAddSemester0Callback = useCallback(() => {
    setSelectedNodes([]); // Clear selection
    setHasUserMadeChanges(true);
    setDegreeTemplate(prevTemplate => {
      if (!prevTemplate || typeof prevTemplate.semesters !== 'object') return prevTemplate;
      if (SEMESTER_0_NAME in prevTemplate.semesters) return prevTemplate;
      return {
        ...prevTemplate,
        semesters: {
          [SEMESTER_0_NAME]: [],
          ...prevTemplate.semesters
        }
      };
    });
  }, []);

  const handleRemoveSemesterCallback = useCallback((semesterKey: string) => {
    setSemesterToDelete(semesterKey);
    setShowDeleteSemesterConfirm(true);
  }, []);

  const handleSelectCourseFromModal = useCallback((selectedCourse: RawCourseData) => {
    if (semesterToAddCourseTo === null || !degreeTemplate) return;

    setDegreeTemplate(prevTemplate => {
      if (!prevTemplate || typeof prevTemplate.semesters !== 'object') return prevTemplate;

      const semesterEntries = sortSemesterEntries(Object.entries(prevTemplate.semesters));
      if (semesterToAddCourseTo <= 0 || semesterToAddCourseTo > semesterEntries.length) {
        console.warn(`Invalid semesterToAddCourseTo: ${semesterToAddCourseTo}, current semester count: ${semesterEntries.length}`);
        return prevTemplate;
      }

      const targetSemesterKey = semesterEntries[semesterToAddCourseTo - 1][0];
      if (lockedSemesters[targetSemesterKey]) {
        return prevTemplate; // Cannot add courses to a locked semester
      }

      const updatedSemesters = { ...prevTemplate.semesters };
      const currentCoursesInTargetSemester = updatedSemesters[targetSemesterKey] || [];

      if (!currentCoursesInTargetSemester.includes(selectedCourse._id)) {
        updatedSemesters[targetSemesterKey] = [...currentCoursesInTargetSemester, selectedCourse._id];
      } else {
        if (import.meta.env.DEV) {
          console.log(`Course ${selectedCourse._id} already in semester ${targetSemesterKey}`);
        }
      }

      return { ...prevTemplate, semesters: updatedSemesters };
    });
    setIsModalOpen(false);
    setSemesterToAddCourseTo(null);
  }, [semesterToAddCourseTo, degreeTemplate, lockedSemesters]);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSemesterToAddCourseTo(null);
  }, []);

  const handleGradeChange = useCallback((courseId: string, grade: string) => {
    setGrades((prevGrades: Record<string, string>) => ({ ...prevGrades, [courseId]: grade }));
    if (grade !== '') {
      setBinaryStates((prevStates: Record<string, boolean>) => { 
        if (prevStates[courseId]) { 
          const newStates = { ...prevStates };
          newStates[courseId] = false; 
          return newStates;
        }
        return prevStates; 
      });
    }
  }, [setGrades, setBinaryStates]);

  const handleBinaryChange = useCallback((courseId: string, isBinary: boolean) => {
    setBinaryStates((prevStates: Record<string, boolean>) => ({ ...prevStates, [courseId]: isBinary }));
    if (isBinary) {
      setGrades((prevGrades: Record<string, string>) => ({
        ...prevGrades,
        [courseId]: '', 
      }));
    }
  }, [setBinaryStates, setGrades]);

  const handleRemoveCourseCallback = useCallback((courseIdToRemove: string) => {
    if (import.meta.env.DEV) {
      console.log(`DegreePlanView: Remove course: ${courseIdToRemove}`);
    }
    setDegreeTemplate(prevTemplate => {
      if (!prevTemplate || typeof prevTemplate.semesters !== 'object') return undefined;

      const updatedSemesters: Record<string, string[]> = {};
      for (const [semesterKey, courseIds] of Object.entries(prevTemplate.semesters)) {
        updatedSemesters[semesterKey] = (courseIds as string[]).filter((id: string) => id !== courseIdToRemove);
      }
      return { ...prevTemplate, semesters: updatedSemesters };
    });
    setGrades(prevGrades => {
      const newGrades = { ...prevGrades };
      delete newGrades[courseIdToRemove];
      return newGrades;
    });
    setSelectedNodes(prevSelected => prevSelected.filter(node => node.id !== courseIdToRemove));
  }, [setDegreeTemplate, setGrades, setSelectedNodes]);

  const handleNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (import.meta.env.DEV) {
      console.log('[DegreePlanView] handleNodeDoubleClick called with node:', node);
    }
    
    // Check if the double-click target is an input element or its descendant
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.closest('input')) {
      if (import.meta.env.DEV) {
        console.log('[DegreePlanView] handleNodeDoubleClick: Ignoring double-click on input element');
      }
      return; // Don't open modal when double-clicking on input elements
    }
    
    if (node.type === 'course' && node.data) {
      const courseData = node.data as CourseNodeData;
      const courseId = courseData.courseId;
      const foundCourse = allCoursesData.find(c => c._id === courseId);
      if (foundCourse) {
        let targetSemesterKey: string | undefined = undefined;
        if (degreeTemplate && degreeTemplate.semesters) {
          for (const [key, courseIdsInSem] of Object.entries(degreeTemplate.semesters)) {
            if (courseIdsInSem.includes(courseId)) {
              targetSemesterKey = key;
              break;
            }
          }
        }
        setCourseDetailModalData({
          course: foundCourse,
          coursesInPlanIds: coursesInPlanFlatIds,
          semesters: degreeTemplate?.semesters,
          targetCourseSemesterKey: targetSemesterKey,
        });
      }
    }
    if (node.type === 'rule' && node.data) {
      const ruleData = node.data as RuleNodeData;
      const ruleId = ruleData.id;
      if (ruleId === CONSOLIDATED_RULES_NODE_ID) {
        const rulesToEdit = degreeTemplate?.rules?.filter(rule =>
          new Set([
            'total_credits', 'credits_from_list', 'min_grade', 'minCredits',
            'minCoursesFromList', 'minCreditsFromMandatory', 'minCreditsFromAnySelectiveList'
          ]).has(rule.type)
        ) || [];
        if (rulesToEdit.length > 0) {
          setRulesForConsolidatedEditing(rulesToEdit);
          setIsConsolidatedRuleEditorOpen(true);
        }
      } else {
        const ruleToEdit = degreeTemplate?.rules?.find(r => r.id === ruleId);
        if (ruleToEdit) {
          setEditingRule(ruleToEdit);
          setIsRuleEditorOpen(true);
        }
      }
    }
  }, [allCoursesData, coursesInPlanFlatIds, degreeTemplate, setCourseDetailModalData, setEditingRule, setIsRuleEditorOpen, setRulesForConsolidatedEditing, setIsConsolidatedRuleEditorOpen]);

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    if (import.meta.env.DEV) {
      console.log('[DegreePlanView] handleNodeClick called with node:', node);
    }
    if (node.type === 'course') {
      setSelectedNodes(prev => {
        if (prev.length === 1 && prev[0].id === node.id) {
          return [];
        }
        return [node];
      });
    }
  }, []);

  const handleSidebarCourseInfoClick = useCallback((course: RawCourseData) => {
    let targetSemesterKey: string | undefined = undefined;
    if (degreeTemplate && degreeTemplate.semesters) {
      for (const [key, courseIdsInSem] of Object.entries(degreeTemplate.semesters)) {
        if (courseIdsInSem.includes(course._id)) {
          targetSemesterKey = key;
          break;
        }
      }
    }
    setCourseDetailModalData({
      course,
      coursesInPlanIds: coursesInPlanFlatIds,
      semesters: degreeTemplate?.semesters,
      targetCourseSemesterKey: targetSemesterKey,
    });
  }, [degreeTemplate, coursesInPlanFlatIds]);

  const handleSidebarCourseClick = useCallback((courseId: string) => {
    if (!degreeTemplate || typeof degreeTemplate.semesters !== 'object') return;

    // 1. Check if exact courseId is already in the plan
    if (coursesInPlanFlatIds.has(courseId)) {
      const targetNode = nodes.find(n => n.type === 'course' && n.id === courseId);
      if (targetNode) {
        setSelectedNodes(prev => (prev.length === 1 && prev[0].id === courseId ? [] : [targetNode]));
      }
      return;
    }

    // 1b. If this course replaces a base mandatory course (e.g., 01140071 replaces 01140051 in Semester 1),
    // swap the base course in-place in its semester and highlight the new course!
    const baseCourseReplacementMap: Record<string, string> = {
      '01140071': '01140051',
      '01140051': '01140071',
      '01140075': '01140052',
      '01140052': '01140075',
      '01040223': '01040228',
      '01040228': '01040223',
    };
    const replacedId = baseCourseReplacementMap[courseId];
    if (replacedId && coursesInPlanFlatIds.has(replacedId)) {
      setHasUserMadeChanges(true);
      setDegreeTemplate(prevTemplate => {
        if (!prevTemplate || typeof prevTemplate.semesters !== 'object') return prevTemplate;
        const updatedSemesters: Record<string, string[]> = {};
        for (const [semKey, list] of Object.entries(prevTemplate.semesters)) {
          updatedSemesters[semKey] = list.map(id => (id === replacedId ? courseId : id));
        }
        return { ...prevTemplate, semesters: updatedSemesters };
      });
      setPendingHighlightCourseId(courseId);
      return;
    }

    // 2. Course is NOT in the plan: find the earliest semester where all prerequisites are MET
    const courseObj = allCoursesData.find(c => c._id === courseId);
    const semesterEntries = sortSemesterEntries(Object.entries(degreeTemplate.semesters));
    if (semesterEntries.length === 0) return;

    let targetSemIdx = -1;
    // Don't auto-place sidebar/sport courses into Semester 0 (reserved for prior/transfer credits)
    const regularStartIdx = semesterEntries[0][0] === SEMESTER_0_NAME ? 1 : 0;

    // Special placement for Sport courses (0394...): place in the first unlocked semester that doesn't already have a sport course
    if (courseId.startsWith('0394')) {
      for (let idx = regularStartIdx; idx < semesterEntries.length; idx++) {
        const sKey = semesterEntries[idx][0];
        if (lockedSemesters[sKey]) continue;
        const list = semesterEntries[idx][1] || [];
        if (!list.some(id => id.startsWith('0394'))) {
          targetSemIdx = idx;
          break;
        }
      }
      if (targetSemIdx === -1) {
        // Find first unlocked semester
        for (let idx = regularStartIdx; idx < semesterEntries.length; idx++) {
          if (!lockedSemesters[semesterEntries[idx][0]]) {
            targetSemIdx = idx;
            break;
          }
        }
        if (targetSemIdx === -1) targetSemIdx = regularStartIdx < semesterEntries.length ? regularStartIdx : 0;
      }
    } else if (courseObj) {
      for (let idx = regularStartIdx; idx < semesterEntries.length; idx++) {
        const sKey = semesterEntries[idx][0];
        if (lockedSemesters[sKey]) continue; // Do not place in locked semesters
        const st = checkPrerequisites(
          courseObj,
          idx + 1,
          degreeTemplate.semesters,
          allCoursesData,
          classificationChecked
        );
        if (st === 'MET') {
          targetSemIdx = idx;
          break;
        }
      }

      // If no semester has 'MET' (e.g. missing prerequisite in plan, or prerequisite is in the last semester),
      // find the highest semester index of any prerequisite currently in the plan and place right after it
      if (targetSemIdx === -1) {
        let maxPrereqSemIdx = -1;
        const collectPrereqSemIndices = (prereqNode: unknown) => {
          if (!prereqNode) return;
          if (typeof prereqNode === 'string') {
            for (let i = 0; i < semesterEntries.length; i++) {
              const list = semesterEntries[i][1] || [];
              for (const placedId of list) {
                if (placedId === prereqNode || getEquivalentCourses(placedId, allCoursesData).has(prereqNode)) {
                  if (i > maxPrereqSemIdx) maxPrereqSemIdx = i;
                }
              }
            }
          } else if (typeof prereqNode === 'object') {
            const obj = prereqNode as Record<string, unknown>;
            if (Array.isArray(obj.and)) obj.and.forEach(collectPrereqSemIndices);
            if (Array.isArray(obj.or)) obj.or.forEach(collectPrereqSemIndices);
            if (Array.isArray(obj.list)) obj.list.forEach(collectPrereqSemIndices);
          }
        };
        collectPrereqSemIndices(courseObj.prereqTree);

        let candidateIdx = maxPrereqSemIdx >= 0 ? maxPrereqSemIdx + 1 : Math.min(semesterEntries.length - 1, 5);
        while (candidateIdx < semesterEntries.length && lockedSemesters[semesterEntries[candidateIdx][0]]) {
          candidateIdx++;
        }
        if (candidateIdx < semesterEntries.length) {
          targetSemIdx = candidateIdx;
        } else {
          // Find first unlocked semester from regularStartIdx
          for (let i = regularStartIdx; i < semesterEntries.length; i++) {
            if (!lockedSemesters[semesterEntries[i][0]]) {
              targetSemIdx = i;
              break;
            }
          }
          if (targetSemIdx === -1) targetSemIdx = Math.min(semesterEntries.length - 1, 5);
        }
      }
    } else {
      targetSemIdx = 0;
    }

    const targetSemesterKey = semesterEntries[targetSemIdx][0];
    if (lockedSemesters[targetSemesterKey]) return; // Safeguard

    setHasUserMadeChanges(true);
    setDegreeTemplate(prevTemplate => {
      if (!prevTemplate || typeof prevTemplate.semesters !== 'object') return prevTemplate;
      const updatedSemesters = { ...prevTemplate.semesters };
      const currentList = updatedSemesters[targetSemesterKey] || [];
      if (!currentList.includes(courseId)) {
        updatedSemesters[targetSemesterKey] = [...currentList, courseId];
      }
      return { ...prevTemplate, semesters: updatedSemesters };
    });
    setPendingHighlightCourseId(courseId);
  }, [degreeTemplate, coursesInPlanFlatIds, nodes, allCoursesData, classificationChecked, lockedSemesters]);

  const handleCloseRuleEditor = useCallback(() => {
    setEditingRule(null);
    setIsRuleEditorOpen(false);
  }, []);

  const handleSaveRule = useCallback((updatedRule: DegreeRule) => {
    if (!degreeTemplate || !degreeTemplate.rules) return;
    const updatedRules = degreeTemplate.rules.map(r => r.id === updatedRule.id ? updatedRule : r);
    const newDegreeTemplate = { ...degreeTemplate, rules: updatedRules };
    setDegreeTemplate(newDegreeTemplate);
    handleCloseRuleEditor();
  }, [degreeTemplate, handleCloseRuleEditor]);

  const handleDeleteRule = useCallback((ruleId: string) => {
    setRuleToDelete(ruleId);
    setShowDeleteRuleConfirm(true);
  }, []);

  const handleSyncRules = useCallback(() => {
    // Show template selection modal first
    setShowSyncTemplateSelection(true);
  }, []);

  const handleConfirmSyncRules = useCallback(() => {
    if (!selectedSyncTemplate) {
      setAlertConfig({ message: "לא נבחרה תכנית לסנכרון", type: 'error' });
      setShowAlert(true);
      return;
    }

    try {
      // Preserve current semester courses
      const currentSemesters = degreeTemplate?.semesters || {};
      
      // Sync rules and course lists from selected template, but keep current semesters
      const syncedTemplate: DegreeTemplate = {
        ...selectedSyncTemplate,
        semesters: currentSemesters // Preserve user's semester course selections
      };

      // Update the degree template with synced rules and lists but preserved semesters
      setDegreeTemplate(syncedTemplate);
      
      // Mark that user has made changes to enable autosave
      setHasUserMadeChanges(true);
      
      setShowSyncRulesConfirm(false);
      setSelectedSyncTemplate(null);
      setAlertConfig({ message: `כללים ורשימות סונכרנו בהצלחה מתכנית "${selectedSyncTemplate.name}"!`, type: 'success' });
      setShowAlert(true);
    } catch (error) {
      console.error('Error during sync:', error);
      setAlertConfig({ message: "שגיאה בסנכרון הכללים", type: 'error' });
      setShowAlert(true);
    }
  }, [selectedSyncTemplate, degreeTemplate, setDegreeTemplate, setHasUserMadeChanges]);

  const handleToggleCourseListEditorModal = useCallback(() => {
    setIsCourseListEditorOpen(prev => !prev);
  }, []);

  const handleSaveCourseLists = useCallback((
    allListsFromModal: Record<string, string[]>,
    renamedLists: Record<string, string>
  ) => {
    if (import.meta.env.DEV) {
      console.debug('[DegreePlanView handleSaveCourseLists] Called with lists:', Object.keys(allListsFromModal));
      console.debug('[DegreePlanView handleSaveCourseLists] Current state - isInitialLoad:', isInitialLoad, 'isLoading:', isLoading);
      console.debug('[DegreePlanView handleSaveCourseLists] Received from modal:', JSON.parse(JSON.stringify(allListsFromModal)));
      console.debug('[DegreePlanView handleSaveCourseLists] MANDATORY_COURSES_LIST_KEY is:', MANDATORY_COURSES_LIST_KEY);
      console.debug('[DegreePlanView handleSaveCourseLists] Mandatory list from modal:', allListsFromModal[MANDATORY_COURSES_LIST_KEY]);
    }

    // Mark that user has made changes to allow autosave even during initial load
    setHasUserMadeChanges(true);
    setDegreeTemplate(prevTemplate => {
      if (!prevTemplate) {
        if (import.meta.env.DEV) console.warn('[DegreePlanView handleSaveCourseLists] prevTemplate is undefined');
        return undefined;
      }
      if (import.meta.env.DEV) {
        console.debug('[DegreePlanView handleSaveCourseLists] prevTemplate.definedMandatoryCourseIds before update:', prevTemplate.definedMandatoryCourseIds);
      }

      const newDefinedMandatoryCourseIds = allListsFromModal[MANDATORY_COURSES_LIST_KEY] !== undefined
        ? allListsFromModal[MANDATORY_COURSES_LIST_KEY]
        : prevTemplate.definedMandatoryCourseIds;
      
      if (import.meta.env.DEV) {
        console.debug('[DegreePlanView handleSaveCourseLists] newDefinedMandatoryCourseIds chosen:', newDefinedMandatoryCourseIds);
      }

      const newCustomCoursesLists: Record<string, string[]> = {};
      for (const listName in allListsFromModal) {
        if (listName !== MANDATORY_COURSES_LIST_KEY) {
          if (allListsFromModal[listName] && allListsFromModal[listName].length > 0) {
            newCustomCoursesLists[listName] = allListsFromModal[listName];
          }
        }
      }

      return {
        ...prevTemplate,
        definedMandatoryCourseIds: newDefinedMandatoryCourseIds,
        "courses-lists": newCustomCoursesLists,
        rules: prevTemplate.rules?.map(rule => renameRuleListReferences(rule, renamedLists)),
      };
    });
    setIsCourseListEditorOpen(false);
  }, [setDegreeTemplate, setIsCourseListEditorOpen, isInitialLoad, isLoading, setHasUserMadeChanges]);

  const handleEditRule = useCallback((ruleId: string) => {
    if (!degreeTemplate || !degreeTemplate.rules) return;

    if (ruleId === CONSOLIDATED_RULES_NODE_ID) {
      const consolidatedRuleTypes = new Set([
        'total_credits', 'credits_from_list', 'min_grade', 'minCredits',
        'minCoursesFromList', 'minCreditsFromMandatory', 'minCreditsFromAnySelectiveList', 'minCreditsFromIdPattern'
      ]);
      const rulesToEdit = degreeTemplate.rules.filter(rule => consolidatedRuleTypes.has(rule.type));
      if (rulesToEdit.length > 0) {
        setRulesForConsolidatedEditing(rulesToEdit);
        setIsConsolidatedRuleEditorOpen(true);
      } else {
        if (import.meta.env.DEV) {
          console.warn("Consolidated rule node edit triggered, but no matching rules found in template.");
        }
      }
    } else {
      const ruleToEdit = degreeTemplate.rules.find(r => r.id === ruleId);
      if (ruleToEdit) {
        setEditingRule(ruleToEdit);
        setIsRuleEditorOpen(true);
      } else {
        if (import.meta.env.DEV) {
          console.warn(`Rule with ID ${ruleId} not found for editing.`);
        }
      }
    }
  }, [degreeTemplate]);

  const handleSaveConsolidatedRules = useCallback((updatedRules: DegreeRule[]) => {
    if (!degreeTemplate) return;

    if (import.meta.env.DEV) {
      console.log('[handleSaveConsolidatedRules] Called with rules:', updatedRules.map(r => ({ id: r.id, type: r.type, description: r.description })));
      console.log('[handleSaveConsolidatedRules] Current state - isInitialLoad:', isInitialLoad, 'isLoading:', isLoading);
      console.log('[handleSaveConsolidatedRules] Current user:', !!currentUser, 'UID:', currentUser?.uid);
    }

    // Mark that user has made changes to allow autosave even during initial load
    setHasUserMadeChanges(true);

    // Initialize rules array if it doesn't exist
    const currentRules = degreeTemplate.rules || [];
    
    // Define consolidated rule types that can be edited
    const consolidatedRuleTypes = new Set([
      'total_credits', 'credits_from_list', 'min_grade', 'minCredits',
      'minCoursesFromList', 'minCreditsFromMandatory', 'minCreditsFromAnySelectiveList', 'minCreditsFromIdPattern'
    ]);
    
    const ruleMap = new Map(updatedRules.map(rule => [rule.id, rule]));
    const existingRuleIds = new Set(currentRules.map(rule => rule.id));
    
    // Keep non-consolidated rules unchanged, and update/remove consolidated rules based on updatedRules
    const newRulesArray = currentRules.filter(originalRule => {
      // Keep non-consolidated rules
      if (!consolidatedRuleTypes.has(originalRule.type)) {
        return true;
      }
      // For consolidated rules, only keep those that still exist in updatedRules
      return ruleMap.has(originalRule.id);
    }).map(originalRule => {
      // Update consolidated rules with new data if available
      return ruleMap.has(originalRule.id) ? ruleMap.get(originalRule.id)! : originalRule;
    });
    
    // Add completely new rules that weren't in the original rules array
    updatedRules.forEach(rule => {
      if (!existingRuleIds.has(rule.id)) {
        newRulesArray.push(rule);
      }
    });

    const newDegreeTemplate = { ...degreeTemplate, rules: newRulesArray };
    
    if (import.meta.env.DEV) {
      console.log('[handleSaveConsolidatedRules] About to save template with rules:');
      console.log('[handleSaveConsolidatedRules] Original rules count:', currentRules.length);
      console.log('[handleSaveConsolidatedRules] Updated rules count:', updatedRules.length);
      console.log('[handleSaveConsolidatedRules] Final rules count:', newRulesArray.length);
      console.log('[handleSaveConsolidatedRules] Final rule IDs:', newRulesArray.map(r => r.id));
      console.log('[handleSaveConsolidatedRules] Final newDegreeTemplate object:', JSON.parse(JSON.stringify(newDegreeTemplate)));
    }
    
    setDegreeTemplate(newDegreeTemplate);
    
    if (import.meta.env.DEV) {
      console.log('[handleSaveConsolidatedRules] setDegreeTemplate called. This should trigger autosave effect.');
    }
    
    setIsConsolidatedRuleEditorOpen(false);
    setRulesForConsolidatedEditing([]);
  }, [degreeTemplate, isInitialLoad, isLoading, currentUser, setHasUserMadeChanges]);

  const handleExportPlan = useCallback(() => {
    if (!degreeTemplate) {
      showAlertMessage('אין תוכנית לימודים לייצוא', 'error');
      return;
    }

    const exportData = {
      degreeTemplate,
      grades,
      classificationChecked,
      classificationCredits,
      binaryStates,
      timestamp: Date.now(),
      exportDate: new Date().toISOString(),
      appVersion: '1.0.0', // You can update this as needed
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `degree-plan-${degreeTemplate.name || 'unknown'}-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }, [degreeTemplate, grades, classificationChecked, classificationCredits, binaryStates]);

  const handleImportPlan = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target?.result as string);
        
        const normalizedImport = normalizeImportedPlan(importedData);
        if (!normalizedImport) {
          showAlertMessage('קובץ לא תקין: מבנה התוכנית או הנתונים שבו אינם תקינים', 'error');
          return;
        }

        setImportData(normalizedImport);
        setShowImportConfirm(true);
      } catch (error) {
        console.error('Error importing plan:', error);
        showAlertMessage('שגיאה בייבוא הקובץ: הקובץ פגום או לא תקין', 'error');
      }
    };
    reader.readAsText(file);
  }, []);

  // Function to restore proper semester ordering and ensure Semester 0 is present
  const fixSemesterOrdering = (template: DegreeTemplate): DegreeTemplate => {
    if (!template.semesters || typeof template.semesters !== 'object') {
      return template;
    }

    const currentSemesters = { ...template.semesters };
    if (!(SEMESTER_0_NAME in currentSemesters)) {
      currentSemesters[SEMESTER_0_NAME] = ['bonus_credits'];
    } else if (currentSemesters[SEMESTER_0_NAME].length === 0) {
      currentSemesters[SEMESTER_0_NAME] = ['bonus_credits'];
    }

    const semesterEntries = sortSemesterEntries(Object.entries(currentSemesters));

    // Rebuild the semesters object with proper ordering
    const orderedSemesters: Record<string, string[]> = {};
    semesterEntries.forEach(([semesterName, courseIds]) => {
      orderedSemesters[semesterName] = courseIds;
    });

    return {
      ...template,
      semesters: orderedSemesters
    };
  };

  useEffect(() => {
    // Safety guard: Count regular courses (excluding Semester 0 bonuses)
    const countCoursesInPlan = (semMap?: Record<string, string[]>): number => {
      if (!semMap || typeof semMap !== 'object') return 0;
      return Object.entries(semMap).reduce((acc, [sName, ids]) => {
        if (sName === SEMESTER_0_NAME || sName.includes('סמסטר 0')) return acc;
        return acc + (Array.isArray(ids) ? ids.filter(id => id && id !== 'bonus_credits').length : 0);
      }, 0);
    };

    // Don't autosave during initial load unless user has made changes, and NEVER autosave an empty plan with 0 courses!
    if (isLoading || !degreeTemplate || (isInitialLoad && !hasUserMadeChanges) || countCoursesInPlan(degreeTemplate.semesters) === 0) {
      if (import.meta.env.DEV) {
        console.log("[DegreePlanView] Autosave effect: Skipped due to guard conditions. isLoading:", isLoading, "degreeTemplate:", !!degreeTemplate, "isInitialLoad:", isInitialLoad, "hasUserMadeChanges:", hasUserMadeChanges, "coursesCount:", countCoursesInPlan(degreeTemplate?.semesters));
        if (degreeTemplate?.rules) {
          console.log("[DegreePlanView] Autosave skipped but template has rules:", degreeTemplate.rules.map(r => r.id));
        }
      }
      return;
    }

    if (import.meta.env.DEV) {
      console.log("[DegreePlanView] Autosave effect: Triggered! Current semesters:", Object.keys(degreeTemplate.semesters || {}));
      console.log("[DegreePlanView] Autosave triggered with template rules:", degreeTemplate.rules?.map(r => r.id) || []);
      console.log("[DegreePlanView] Autosave - degreeTemplate object hash:", JSON.stringify(degreeTemplate).substring(0, 100) + '...');
    }

    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    setSaveStatus('saving');

    autosaveTimeoutRef.current = window.setTimeout(() => {
      if (import.meta.env.DEV) {
        console.log("[DegreePlanView] Autosave timeout executed! CurrentUser:", !!currentUser, "UID:", currentUser?.uid);
        console.log("[DegreePlanView] Template semesters at save time:", Object.keys(degreeTemplate.semesters || {}));
      }
      
      if (currentUser && currentUser.uid) {
        if (import.meta.env.DEV) {
          console.log("[DegreePlanView] Autosaving plan to Firestore for user:", currentUser.uid);
          console.log("[DegreePlanView] Autosave - Template rules being saved:", degreeTemplate.rules?.map(r => r.id) || []);
        }
        savePlanToFirestore(
          currentUser.uid,
          degreeTemplate,
          grades,
          classificationChecked,
          classificationCredits,
          binaryStates,
          lockedSemesters
        ).then(() => {
          if (import.meta.env.DEV) {
            console.log("[DegreePlanView] Firestore save completed successfully");
            console.log("[DegreePlanView] Firestore save - Template rules that were saved:", degreeTemplate.rules?.map(r => r.id) || []);
          }
          setSaveStatus('saved');
        }).catch(error => {
          if (import.meta.env.DEV) {
            console.error("[DegreePlanView] Error autosaving to Firestore:", error);
          }
          setSaveStatus('idle');
        });
      } else {
        if (import.meta.env.DEV) {
          console.log("[DegreePlanView] Autosaving plan to local storage (no user logged in)...");
        }
        savePlan(degreeTemplate, grades, classificationChecked, classificationCredits, binaryStates, lockedSemesters);
        setSaveStatus('saved');
      }
    }, 1500);

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [degreeTemplate, grades, classificationChecked, classificationCredits, binaryStates, lockedSemesters, currentUser, authLoading, setSaveStatus, isLoading, isInitialLoad, hasUserMadeChanges]);

  useEffect(() => {
    const loadInitialData = async () => {
      if (import.meta.env.DEV) {
        console.log("[DegreePlanView] Initial Load Effect Triggered. Auth Loading:", authLoading, "CurrentUser:", !!currentUser);
      }
  
      if (authLoading) {
        if (import.meta.env.DEV) {
          console.log("[DegreePlanView] Initial Load: Waiting for auth state...");
        }
        setIsLoading(true);
        return;
      }
  
      setIsLoading(true);
  
      try {
        const courses = await fetchAllCourses();
        if (import.meta.env.DEV) {
          console.log("[DegreePlanView] Initial Load: Fetched allCourses:", courses.length);
        }
        setAllCoursesData(courses);
  
        const fetchedDegreeFileData = await fetchDegreeTemplates();
        if (import.meta.env.DEV) {
          console.log("[DegreePlanView] Initial Load: Fetched degree file data.");
        }
  
        let templateForProcessing: DegreeTemplate | undefined = undefined;
        const globalRulesForProcessing: DegreeRule[] = fetchedDegreeFileData?.globalRules || [];
        let gradesForProcessing: Record<string, string> = {};
        let classificationCheckedForProcessing: Record<string, boolean> = {};
        let classificationCreditsForProcessing: Record<string, number> = {};
        let binaryStatesForProcessing: Record<string, boolean> = {};
        let lockedSemestersForProcessing: Record<string, boolean> = {};
        let loadedFrom: 'firestore' | 'local' | 'default' = 'default';

        const countRegularCourses = (semMap?: Record<string, string[]>): number => {
          if (!semMap || typeof semMap !== 'object') return 0;
          return Object.entries(semMap).reduce((acc, [sName, ids]) => {
            if (sName === SEMESTER_0_NAME || sName.includes('סמסטר 0')) return acc;
            return acc + (Array.isArray(ids) ? ids.filter(id => id && id !== 'bonus_credits').length : 0);
          }, 0);
        };
  
        if (currentUser && currentUser.uid) {
          if (import.meta.env.DEV) {
            console.log("[DegreePlanView] Initial Load: User logged in (" + currentUser.uid + "). Trying Firestore...");
          }
          const firestorePlan = await loadPlanFromFirestore(currentUser.uid);
  
          if (firestorePlan && firestorePlan.degreeTemplate && countRegularCourses(firestorePlan.degreeTemplate.semesters) > 0) {
            if (import.meta.env.DEV) {
              console.log("[DegreePlanView] Initial Load: Found plan in Firestore.");
            }
            loadedFrom = 'firestore';
            templateForProcessing = fixSemesterOrdering(firestorePlan.degreeTemplate);
            
            // Ensure ID exists, especially for older Firestore plans
            if (!templateForProcessing.id && fetchedDegreeFileData) {
              for (const key in fetchedDegreeFileData) {
                if (key !== 'globalRules') {
                  const pristineTemplate = fetchedDegreeFileData[key] as DegreeTemplate;
                  if (pristineTemplate.name === templateForProcessing.name) {
                    templateForProcessing.id = pristineTemplate.id; // Which is 'key'
                    if (import.meta.env.DEV) {
                      console.log(`[DegreePlanView] Initial Load: Assigned missing ID '${templateForProcessing.id}' to Firestore template based on name match.`);
                    }
                    break;
                  }
                }
              }
            }
            
            // Only use fresh rules if no rules exist or rules are empty, preserve user customizations
            if (templateForProcessing.id && fetchedDegreeFileData && fetchedDegreeFileData[templateForProcessing.id]) {
              if (!templateForProcessing.rules || templateForProcessing.rules.length === 0) {
                const freshTemplate = fetchedDegreeFileData[templateForProcessing.id] as DegreeTemplate;
                templateForProcessing.rules = freshTemplate.rules;
                if (import.meta.env.DEV) {
                  console.log(`[DegreePlanView] Initial Load: Used fresh rules from template file for '${templateForProcessing.id}' (no existing rules)`);
                }
              } else {
                if (import.meta.env.DEV) {
                  console.log(`[DegreePlanView] Initial Load: Preserved user customized rules for '${templateForProcessing.id}' (${templateForProcessing.rules.length} rules)`);
                }
              }
            }
            gradesForProcessing = firestorePlan.grades || {};
            classificationCheckedForProcessing = firestorePlan.classificationChecked || {};
            classificationCreditsForProcessing = firestorePlan.classificationCredits || {};
            binaryStatesForProcessing = firestorePlan.binaryStates || {};
            lockedSemestersForProcessing = firestorePlan.lockedSemesters || {};
          } else {
            if (import.meta.env.DEV) {
              console.log("[DegreePlanView] Initial Load: No plan found in Firestore for user. Loading default template.");
            }
            loadedFrom = 'default';
            const defaultTemplateId = 'mechanical-engineering-general';
            const defaultRaw = (
              fetchedDegreeFileData?.[defaultTemplateId] ||
              Object.values(fetchedDegreeFileData || {}).find(t => t && typeof t === 'object' && 'semesters' in t) ||
              getDefaultDegreesData()[defaultTemplateId]
            ) as DegreeTemplate | undefined;
            templateForProcessing = defaultRaw ? fixSemesterOrdering(JSON.parse(JSON.stringify(defaultRaw))) : undefined;
            gradesForProcessing = {};
            classificationCheckedForProcessing = {};
            classificationCreditsForProcessing = {};
            binaryStatesForProcessing = {};
            lockedSemestersForProcessing = {};
  
            if (templateForProcessing) {
              if (import.meta.env.DEV) {
                console.log("[DegreePlanView] Initial Load: Triggering initial save of default template to Firestore for user:", currentUser.uid);
              }
              await savePlanToFirestore(
                currentUser.uid,
                templateForProcessing,
                gradesForProcessing,
                classificationCheckedForProcessing,
                classificationCreditsForProcessing,
                binaryStatesForProcessing
              );
            }
          }
        } else {
          if (import.meta.env.DEV) {
            console.log("[DegreePlanView] Initial Load: No user logged in. Trying local storage...");
          }
          const savedPlanData: StoredPlan | null = loadPlan();
          if (savedPlanData && savedPlanData.template && countRegularCourses(savedPlanData.template.semesters) > 0) {
            if (import.meta.env.DEV) {
              console.log("[DegreePlanView] Initial Load: Found plan in local storage.");
            }
            loadedFrom = 'local';
            templateForProcessing = fixSemesterOrdering(savedPlanData.template);
            // Ensure ID exists, especially for older local storage plans
            if (import.meta.env.DEV) {
                console.debug('[DegreePlanView Initial Load] Local plan loaded, template.id BEFORE potential fix:', templateForProcessing?.id);
            }
            if (!templateForProcessing.id && fetchedDegreeFileData) {
              for (const key in fetchedDegreeFileData) {
                if (key !== 'globalRules') {
                  const pristineTemplate = fetchedDegreeFileData[key] as DegreeTemplate;
                  // Ensure pristineTemplate and its name are defined
                  if (pristineTemplate && pristineTemplate.name && pristineTemplate.id && templateForProcessing.name === pristineTemplate.name) {
                    templateForProcessing.id = pristineTemplate.id; // pristineTemplate.id should be 'key' due to dataLoader changes
                    if (import.meta.env.DEV) {
                      console.log(`[DegreePlanView] Initial Load: Assigned missing ID '${templateForProcessing.id}' to local storage template '${templateForProcessing.name}' based on name match with pristine template '${key}'.`);
                    }
                    break;
                  }
                }
              }
            }
            if (import.meta.env.DEV) {
                console.debug('[DegreePlanView Initial Load] Local plan loaded, template.id AFTER potential fix:', templateForProcessing?.id);
            }

            // Only use fresh rules if no rules exist or rules are empty, preserve user customizations
            if (templateForProcessing.id && fetchedDegreeFileData && fetchedDegreeFileData[templateForProcessing.id]) {
              if (!templateForProcessing.rules || templateForProcessing.rules.length === 0) {
                const freshTemplate = fetchedDegreeFileData[templateForProcessing.id] as DegreeTemplate;
                templateForProcessing.rules = freshTemplate.rules;
                if (import.meta.env.DEV) {
                  console.log(`[DegreePlanView] Initial Load: Used fresh rules from template file for '${templateForProcessing.id}' (from local storage, no existing rules)`);
                }
              } else {
                if (import.meta.env.DEV) {
                  console.log(`[DegreePlanView] Initial Load: Preserved user customized rules for '${templateForProcessing.id}' from local storage (${templateForProcessing.rules.length} rules)`);
                }
              }
            }

            gradesForProcessing = savedPlanData.grades || {};
            classificationCheckedForProcessing = savedPlanData.classificationChecked || {};
            classificationCreditsForProcessing = savedPlanData.classificationCredits || {};
            binaryStatesForProcessing = savedPlanData.binaryStates || {};
            lockedSemestersForProcessing = savedPlanData.lockedSemesters || {};
          } else {
            if (import.meta.env.DEV) {
              console.log("[DegreePlanView] Initial Load: No valid plan found in local storage. Loading default template.");
            }
            loadedFrom = 'default';
            const defaultTemplateId = 'mechanical-engineering-general';
            const defaultRaw = (
              fetchedDegreeFileData?.[defaultTemplateId] ||
              Object.values(fetchedDegreeFileData || {}).find(t => t && typeof t === 'object' && 'semesters' in t) ||
              getDefaultDegreesData()[defaultTemplateId]
            ) as DegreeTemplate | undefined;
            templateForProcessing = defaultRaw ? fixSemesterOrdering(JSON.parse(JSON.stringify(defaultRaw))) : undefined;
            gradesForProcessing = {};
            classificationCheckedForProcessing = {};
            classificationCreditsForProcessing = {};
            binaryStatesForProcessing = {};
            lockedSemestersForProcessing = {};
          }
        }
  
        if (templateForProcessing) {
          if (import.meta.env.DEV) {
            console.log(`[DegreePlanView] Initial Load: Setting state. Loaded from: ${loadedFrom}`);
          }
          if (import.meta.env.DEV) {
            console.debug('[DegreePlanView Initial Load] templateForProcessing right before processing definedMandatoryCourseIds:', JSON.parse(JSON.stringify(templateForProcessing)));
          }

          // Ensure specialization-paths and courses-lists are hydrated from fresh template if missing
          const defaultInMemTemplates = getDefaultDegreesData();
          const freshTemplateForHydration = (
            (templateForProcessing.id && fetchedDegreeFileData?.[templateForProcessing.id]) ||
            fetchedDegreeFileData?.['mechanical-engineering-general'] ||
            (templateForProcessing.id && defaultInMemTemplates?.[templateForProcessing.id]) ||
            defaultInMemTemplates?.['mechanical-engineering-general']
          ) as DegreeTemplate | undefined;

          if (freshTemplateForHydration) {
            if (freshTemplateForHydration['specialization-paths']) {
              templateForProcessing['specialization-paths'] = freshTemplateForHydration['specialization-paths'];
            }
            if (freshTemplateForHydration['courses-lists']) {
              templateForProcessing['courses-lists'] = {
                ...(templateForProcessing['courses-lists'] || {}),
                ...freshTemplateForHydration['courses-lists'],
              };
            }
          }

          // Ensure definedMandatoryCourseIds is populated if missing
          if (!templateForProcessing.definedMandatoryCourseIds || templateForProcessing.definedMandatoryCourseIds.length === 0) {
            if (freshTemplateForHydration?.definedMandatoryCourseIds && freshTemplateForHydration.definedMandatoryCourseIds.length > 0) {
              templateForProcessing.definedMandatoryCourseIds = freshTemplateForHydration.definedMandatoryCourseIds;
            } else if (templateForProcessing.semesters && Object.keys(templateForProcessing.semesters).length > 0) {
              const semesterBasedMandatoryIds = Object.values(templateForProcessing.semesters).flat().filter(id => typeof id === 'string');
              templateForProcessing.definedMandatoryCourseIds = semesterBasedMandatoryIds;
              if (import.meta.env.DEV) {
                console.debug('[DegreePlanView Initial Load] Populated templateForProcessing.definedMandatoryCourseIds from semesters:', semesterBasedMandatoryIds);
              }
            } else {
              templateForProcessing.definedMandatoryCourseIds = []; // Default to empty if no semesters either
              if (import.meta.env.DEV) {
                console.debug('[DegreePlanView Initial Load] Initialized templateForProcessing.definedMandatoryCourseIds as empty (no pre-existing and no semesters).');
              }
            }
          } else {
            if (import.meta.env.DEV) {
              console.debug('[DegreePlanView Initial Load] templateForProcessing already had definedMandatoryCourseIds:', templateForProcessing.definedMandatoryCourseIds);
            }
          }

          // Auto-healing safety: If the loaded template has 0 courses in its regular semesters, restore from fresh syllabus template!
          const countRegularCourses = (semMap?: Record<string, string[]>): number => {
            if (!semMap || typeof semMap !== 'object') return 0;
            return Object.entries(semMap).reduce((acc, [sName, ids]) => {
              if (sName === SEMESTER_0_NAME || sName.includes('סמסטר 0')) return acc;
              return acc + (Array.isArray(ids) ? ids.filter(id => id && id !== 'bonus_credits').length : 0);
            }, 0);
          };

          const coursesInSemesters = countRegularCourses(templateForProcessing.semesters);
          const fallbackSemestersSource = freshTemplateForHydration?.semesters || defaultInMemTemplates?.['mechanical-engineering-general']?.semesters;
          if (coursesInSemesters === 0 && fallbackSemestersSource) {
            console.warn('[DegreePlanView Initial Load] Loaded plan has 0 regular courses! Auto-healing courses from fresh syllabus template.');
            templateForProcessing.semesters = JSON.parse(JSON.stringify(fallbackSemestersSource));
            if (!(SEMESTER_0_NAME in templateForProcessing.semesters)) {
              templateForProcessing.semesters = { [SEMESTER_0_NAME]: ['bonus_credits'], ...templateForProcessing.semesters };
            } else if (templateForProcessing.semesters[SEMESTER_0_NAME].length === 0) {
              templateForProcessing.semesters[SEMESTER_0_NAME] = ['bonus_credits'];
            }
            if (!templateForProcessing.rules || templateForProcessing.rules.length === 0) {
              templateForProcessing.rules = freshTemplateForHydration?.rules || defaultInMemTemplates?.['mechanical-engineering-general']?.rules;
            }
          }

          setDegreeTemplate(templateForProcessing);
        setCurrentGlobalRules(globalRulesForProcessing);
        setGrades(gradesForProcessing);
        setClassificationChecked(classificationCheckedForProcessing);
        setClassificationCredits(classificationCreditsForProcessing);
        setBinaryStates(binaryStatesForProcessing);
        setLockedSemesters(lockedSemestersForProcessing);
        
        // Only show template selection if this is a first-time user with no saved plan
        if (loadedFrom === 'default' && !currentUser) {
          setShowTemplateSelection(true);
          setIsSwitchingTemplate(false);
        }
      } else {
        if (import.meta.env.DEV) {
          console.error("[DegreePlanView] Initial Load: No template could be loaded (neither saved nor default).");
        }
        // No template could be loaded - show template selection
        setShowTemplateSelection(true);
        setIsSwitchingTemplate(false);
      }
  
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error("[DegreePlanView] Initial Load: Error loading initial data:", error);
        }
      } finally {
        if (import.meta.env.DEV) {
          console.log("[DegreePlanView] Initial Load: Finished processing. Setting isLoading to false.");
        }
        setIsLoading(false);
        setIsInitialLoad(false);
      }
    };
  
    loadInitialData();
  }, [currentUser, authLoading]);

  // Reactive self-healing safeguard: if active degreeTemplate regular semesters have 0 courses, restore from allTemplatesData or fetch fresh templates
  useEffect(() => {
    if (isLoading || !degreeTemplate) return;
    const countRegularCourses = (semMap?: Record<string, string[]>): number => {
      if (!semMap || typeof semMap !== 'object') return 0;
      return Object.entries(semMap).reduce((acc, [sName, ids]) => {
        if (sName === SEMESTER_0_NAME || sName.includes('סמסטר 0')) return acc;
        return acc + (Array.isArray(ids) ? ids.filter(id => id && id !== 'bonus_credits').length : 0);
      }, 0);
    };

    if (countRegularCourses(degreeTemplate.semesters) === 0) {
      const healCourses = async () => {
        let templates = allTemplatesData;
        if (!templates || Object.keys(templates).length === 0) {
          templates = await fetchDegreeTemplates();
        }
        if (!templates || Object.keys(templates).length === 0) {
          templates = getDefaultDegreesData();
        }
        const defaultTmpl =
          (degreeTemplate.id && templates?.[degreeTemplate.id]) ||
          templates?.['mechanical-engineering-general'] ||
          getDefaultDegreesData()['mechanical-engineering-general'] ||
          Object.values(templates || {})[0];
        if (defaultTmpl && defaultTmpl.semesters && countRegularCourses(defaultTmpl.semesters) > 0) {
          console.warn('[DegreePlanView] Active degreeTemplate has 0 courses! Restoring default syllabus semesters.');
          setDegreeTemplate(prev => {
            if (!prev) return defaultTmpl;
            const updated = {
              ...prev,
              semesters: JSON.parse(JSON.stringify(defaultTmpl.semesters)),
              rules: (prev.rules && prev.rules.length > 0) ? prev.rules : defaultTmpl.rules,
            };
            if (!(SEMESTER_0_NAME in updated.semesters)) {
              updated.semesters = { [SEMESTER_0_NAME]: ['bonus_credits'], ...updated.semesters };
            }
            return updated;
          });
        }
      };
      healCourses();
    }
  }, [isLoading, degreeTemplate, allTemplatesData]);

  useEffect(() => {
    const selectedCourseNodes = selectedNodes.filter(n => n.type === 'course');

    if (selectedCourseNodes.length > 0) {
      const selectedIds = new Set(selectedCourseNodes.map(node => node.id));

      // Build a map of courseId -> semester index (0 for Semester 0, 1 for Semester 1, etc.)
      const courseSemesterMap = new Map<string, number>();
      if (degreeTemplate && degreeTemplate.semesters) {
        const sortedSemEntries = sortSemesterEntries(Object.entries(degreeTemplate.semesters));
        sortedSemEntries.forEach(([_, ids], sIdx) => {
          ids.forEach(id => courseSemesterMap.set(id, sIdx));
        });
      }

      // If one course is selected, find its semester index to help calculate semester distance
      const primarySelectedId = selectedCourseNodes[0].id;
      const selectedCourseSemIdx = courseSemesterMap.get(primarySelectedId) ?? 0;

      setEdges(prevEdges => {
        // 1. BFS for Ancestors (Prerequisites / Going Back)
        // ancestorHops: maps courseId -> hop distance (1 = direct prerequisite, 2 = 2nd order, etc.)
        const ancestorHops = new Map<string, number>();
        let currentLevel = new Set<string>(selectedIds);
        let hop = 1;
        while (currentLevel.size > 0) {
          const nextLevel = new Set<string>();
          for (const edge of prevEdges) {
            if (currentLevel.has(edge.target) && !selectedIds.has(edge.source) && !ancestorHops.has(edge.source)) {
              ancestorHops.set(edge.source, hop);
              nextLevel.add(edge.source);
            }
          }
          currentLevel = nextLevel;
          hop++;
        }

        // 2. BFS for Descendants (Next Courses / Going Forward)
        // descendantHops: maps courseId -> hop distance (1 = direct next course, 2 = 2nd order, etc.)
        const descendantHops = new Map<string, number>();
        currentLevel = new Set<string>(selectedIds);
        hop = 1;
        while (currentLevel.size > 0) {
          const nextLevel = new Set<string>();
          for (const edge of prevEdges) {
            if (currentLevel.has(edge.source) && !selectedIds.has(edge.target) && !descendantHops.has(edge.target)) {
              descendantHops.set(edge.target, hop);
              nextLevel.add(edge.target);
            }
          }
          currentLevel = nextLevel;
          hop++;
        }

        // 3. Style edges with gradient based on chain order and semester distance
        const updatedEdges = prevEdges.map(edge => {
          // Backward / Prerequisite chain: edge connects an ancestor to selected or another ancestor
          const isPrereqChainEdge = ancestorHops.has(edge.source) && (selectedIds.has(edge.target) || ancestorHops.has(edge.target));
          // Forward / Dependent chain: edge connects selected or descendant to a descendant
          const isDependentChainEdge = descendantHops.has(edge.target) && (selectedIds.has(edge.source) || descendantHops.has(edge.source));

          if (isPrereqChainEdge) {
            const isDirectToSelected = selectedIds.has(edge.target);

            if (isDirectToSelected) {
              // 1st ORDER LINK: Direct prerequisite connected directly to selected course
              // Always 100% visible, boldest stroke, on very top z-index
              return {
                ...edge,
                style: {
                  ...edge.style,
                  stroke: '#ef4444', // Bright bold red
                  strokeWidth: 3.2,
                  strokeOpacity: 1.0,
                },
                markerEnd: { type: MarkerType.ArrowClosed, color: '#ef4444' },
                zIndex: 100,
              };
            } else {
              // DEEPER ANCESTOR LINK: Preceding links in earlier semesters
              // Calculate hop and semester distance to fade progressively
              const targetHop = ancestorHops.get(edge.target) ?? 1;
              const edgeHop = targetHop + 1; // 2 for 2nd order, 3 for 3rd order...

              const sourceSem = courseSemesterMap.get(edge.source);
              const semDistance = sourceSem !== undefined ? Math.max(1, selectedCourseSemIdx - sourceSem) : edgeHop;

              // Opacity gradient: fades with distance, but never drops below 0.28
              let opacity = 0.75;
              let strokeWidth = 2.4;
              let zIndex = 60;
              let strokeColor = '#f87171'; // Lighter coral red
              let strokeDasharray: string | undefined = undefined;

              if (edgeHop === 3 || semDistance === 3) {
                opacity = 0.48;
                strokeWidth = 1.8;
                zIndex = 40;
                strokeColor = '#ef4444';
                strokeDasharray = '5 4'; // Dotted/dashed for far distance
              } else if (edgeHop >= 4 || semDistance >= 4) {
                opacity = Math.max(0.28, 0.40 - (edgeHop - 4) * 0.05);
                strokeWidth = 1.5;
                zIndex = 20;
                strokeColor = '#dc2626';
                strokeDasharray = '4 4'; // Fainter dotted for very far distance
              }

              return {
                ...edge,
                style: {
                  ...edge.style,
                  stroke: strokeColor,
                  strokeWidth,
                  strokeOpacity: opacity,
                  strokeDasharray,
                },
                markerEnd: { type: MarkerType.ArrowClosed, color: strokeColor },
                zIndex,
              };
            }
          } else if (isDependentChainEdge) {
            const isDirectFromSelected = selectedIds.has(edge.source);

            if (isDirectFromSelected) {
              // 1st ORDER FORWARD LINK: Direct next course starting from selected course
              // Always 100% visible, boldest stroke, on very top z-index
              return {
                ...edge,
                style: {
                  ...edge.style,
                  stroke: '#f59e0b', // Bright amber/orange
                  strokeWidth: 3.2,
                  strokeOpacity: 1.0,
                  strokeDasharray: undefined,
                },
                markerEnd: { type: MarkerType.ArrowClosed, color: '#f59e0b' },
                zIndex: 100,
              };
            } else {
              // DEEPER DESCENDANT LINK: Forward links further down the chain
              const sourceHop = descendantHops.get(edge.source) ?? 1;
              const edgeHop = sourceHop + 1;

              const targetSem = courseSemesterMap.get(edge.target);
              const semDistance = targetSem !== undefined ? Math.max(1, targetSem - selectedCourseSemIdx) : edgeHop;

              let opacity = 0.75;
              let strokeWidth = 2.4;
              let zIndex = 60;
              let strokeColor = '#fbbf24';
              let strokeDasharray: string | undefined = undefined;

              if (edgeHop === 3 || semDistance === 3) {
                opacity = 0.48;
                strokeWidth = 1.8;
                zIndex = 40;
                strokeColor = '#f59e0b';
                strokeDasharray = '5 4'; // Dotted/dashed for far distance
              } else if (edgeHop >= 4 || semDistance >= 4) {
                opacity = Math.max(0.28, 0.40 - (edgeHop - 4) * 0.05);
                strokeWidth = 1.5;
                zIndex = 20;
                strokeColor = '#d97706';
                strokeDasharray = '4 4'; // Fainter dotted for very far distance
              }

              return {
                ...edge,
                style: {
                  ...edge.style,
                  stroke: strokeColor,
                  strokeWidth,
                  strokeOpacity: opacity,
                  strokeDasharray,
                },
                markerEnd: { type: MarkerType.ArrowClosed, color: strokeColor },
                zIndex,
              };
            }
          }

          // Unrelated edges: deeply dimmed in background (very faint)
          return {
            ...edge,
            style: {
              ...edge.style,
              stroke: '#64748b',
              strokeWidth: 1.0,
              strokeOpacity: 0.02,
              strokeDasharray: undefined,
            },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' },
            zIndex: 0,
          };
        });

        // 4. Update nodes with halo highlights and opacities
        setNodes(prevNodes =>
          prevNodes.map(node => {
            if (node.type !== 'course') {
              return node;
            }

            const isSelected = selectedIds.has(node.id);
            const ancestorHop = ancestorHops.get(node.id);
            const descendantHop = descendantHops.get(node.id);

            let highlightRole: CourseNodeData['highlightRole'] = null;
            let opacity = 0.92; // Keep unrelated courses fully bright and readable (never dark or invisible!)

            if (isSelected) {
              highlightRole = 'selected';
              opacity = 1.0;
            } else if (ancestorHop !== undefined) {
              highlightRole = ancestorHop === 1 ? 'prereq-direct' : 'prereq-ancestor';
              opacity = 1.0;
            } else if (descendantHop !== undefined) {
              highlightRole = descendantHop === 1 ? 'dep-direct' : 'dep-descendant';
              opacity = 1.0;
            }

            return {
              ...node,
              data: {
                ...(node.data as CourseNodeData),
                highlightRole,
                highlightHop: ancestorHop ?? descendantHop,
              },
              style: {
                ...node.style,
                opacity,
                transition: 'opacity 0.2s ease',
              },
            };
          })
        );

        return updatedEdges;
      });
    } else {
      // Reset both edges and nodes when no course is selected
      setEdges(prevEdges =>
        prevEdges.map(edge => ({
          ...edge,
          style: { stroke: '#94a3b8', strokeWidth: 1.4, strokeOpacity: 0.18, strokeDasharray: undefined },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
          zIndex: 0,
        }))
      );

      setNodes(prevNodes =>
        prevNodes.map(node => {
          if (node.type !== 'course') return node;
          return {
            ...node,
            data: {
              ...(node.data as CourseNodeData),
              highlightRole: null,
              highlightHop: undefined,
            },
            style: {
              ...node.style,
              opacity: 1.0,
            },
          };
        })
      );
    }
  }, [selectedNodes, degreeTemplate?.semesters, setEdges, setNodes]);

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log("[DegreePlanView] Node/Edge Update Effect: Triggered. import.meta.env.DEV:", import.meta.env.DEV);
      console.log("[DegreePlanView] Node/Edge Update Effect: Guard conditions - isLoading:", isLoading, "!degreeTemplate:", !degreeTemplate, "!Array.isArray(allCoursesData):", !Array.isArray(allCoursesData), "allCoursesData.length === 0:", Array.isArray(allCoursesData) && allCoursesData.length === 0);
    }
    
    if (isLoading || !degreeTemplate || !Array.isArray(allCoursesData) || allCoursesData.length === 0) {
      if (import.meta.env.DEV) {
        console.log("[DegreePlanView] Node/Edge Update Effect: Guarded. Not generating nodes/edges yet.");
        if (isLoading) console.log("Reason: isLoading is true.");
        if (!degreeTemplate) console.log("Reason: currentTemplate is falsy.");
        if (!Array.isArray(allCoursesData)) console.log("Reason: allCourses is not an array.");
        if (Array.isArray(allCoursesData) && allCoursesData.length === 0) console.log("Reason: allCourses is an empty array.");
      }
      if (!isLoading && nodes.length > 0) {
         if (import.meta.env.DEV) {
           console.log("[DegreePlanView] Node/Edge Update Effect: Clearing existing nodes as conditions not met.");
         }
         setNodes([]);
         setEdges([]);
      }
      return;
    }

    if (import.meta.env.DEV) {
      console.log("[DegreePlanView] Node/Edge Update Effect: Guard passed. Generating nodes and edges...");
    }
    try {
      const newNodes = transformDataToNodes(
        degreeTemplate,
        allCoursesData,
        grades, 
        binaryStates,
        handleBinaryChange, 
        handleAddCourseToSemesterCallback, 
        handleAddSemesterCallback,
        handleGradeChange,
        handleRemoveCourseCallback,
        classificationChecked,
        handleClassificationToggle,
        classificationCredits,
        handleClassificationCreditsChange,
        currentGlobalRules,
        allTemplatesData,
        handleEditRule,
        handleDeleteRule,
        handleSyncRules,
        handleToggleCourseListEditorModal,
        handleRemoveSemesterCallback,
        handleBonusCreditsChange,
        handleAddBonusCourseToSemester0,
        lockedSemesters,
        handleToggleSemesterLock
      );
      const newEdges = transformDataToEdges(degreeTemplate, allCoursesData);
      if (import.meta.env.DEV) {
        console.log("[DegreePlanView] Node/Edge Update Effect: Generated newNodes count:", newNodes.length, "newEdges count:", newEdges.length);
      }
      
      setNodes(() => newNodes);
      setEdges(() => newEdges);
      if (pendingHighlightCourseId) {
        const addedNode = newNodes.find(n => n.type === 'course' && n.id === pendingHighlightCourseId);
        if (addedNode) {
          addedNode.selected = true;
          setSelectedNodes([addedNode]);
        }
        setPendingHighlightCourseId(null);
      }
    } catch (err) {
      console.error("[DegreePlanView] Error updating nodes/edges:", err);
    }
  }, [
    degreeTemplate, allCoursesData, grades, binaryStates, classificationChecked, 
    classificationCredits, currentGlobalRules,
    handleAddCourseToSemesterCallback, handleAddSemesterCallback, handleGradeChange, 
    handleRemoveCourseCallback, handleBinaryChange, handleClassificationToggle, 
    handleClassificationCreditsChange, handleEditRule, handleDeleteRule, handleSyncRules, handleToggleCourseListEditorModal,
    handleRemoveSemesterCallback, handleBonusCreditsChange, handleAddBonusCourseToSemester0,
    lockedSemesters, handleToggleSemesterLock,
    setNodes, setEdges, isLoading, allTemplatesData, pendingHighlightCourseId
  ]);

  const handleSelectionChange = useCallback(({ nodes: selNodes }: OnSelectionChangeParams) => {
    setSelectedNodes(selNodes);
  }, [setSelectedNodes]);

  const { availableCoursesForModal, alreadyTakenCoursesForModal } = useMemo(() => {
    if (!degreeTemplate || typeof degreeTemplate.semesters !== 'object' || degreeTemplate.semesters === null || !Array.isArray(allCoursesData)) {
      if (degreeTemplate && (typeof degreeTemplate.semesters !== 'object' || degreeTemplate.semesters === null)) {
        console.warn('Data Structure Warning (availableCoursesForModal): currentTemplate.semesters is not an object!', degreeTemplate.semesters);
      }
      return {
        availableCoursesForModal: Array.isArray(allCoursesData) ? allCoursesData.filter(course => !course.isClassificationCourse) : [],
        alreadyTakenCoursesForModal: []
      };
    }
    const coursesInPlan = new Set<string>();
    Object.values(degreeTemplate.semesters).forEach(semesterCourseList => {
      semesterCourseList.forEach(id => coursesInPlan.add(id));
    });
    
    const available = allCoursesData.filter(course => !coursesInPlan.has(course._id) && !course.isClassificationCourse);
    const alreadyTaken = allCoursesData.filter(course => coursesInPlan.has(course._id) && !course.isClassificationCourse);

    const bonusVirtualCourse: RawCourseData = {
      _id: 'bonus_credits',
      name: '🎁 בונוסים (סמסטר 0)',
      credits: classificationCredits['bonus_credits'] ?? 2.5,
      hours: '',
      prereqTree: null,
      semesters: [],
      isClassificationCourse: false,
    };

    if (!coursesInPlan.has('bonus_credits')) {
      available.unshift(bonusVirtualCourse);
    } else {
      alreadyTaken.push(bonusVirtualCourse);
    }
    
    return {
      availableCoursesForModal: available,
      alreadyTakenCoursesForModal: alreadyTaken
    };
  }, [allCoursesData, degreeTemplate, classificationCredits]);

  interface PlanHistorySnapshot {
    degreeTemplate: DegreeTemplate;
    grades: Record<string, string>;
    classificationChecked: Record<string, boolean>;
    classificationCredits: Record<string, number>;
    binaryStates: Record<string, boolean>;
    lockedSemesters: Record<string, boolean>;
  }

  const undoStackRef = useRef<PlanHistorySnapshot[]>([]);
  const redoStackRef = useRef<PlanHistorySnapshot[]>([]);
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);
  const isHistoryOperationRef = useRef<boolean>(false);
  const lastRecordedSnapshotRef = useRef<string | null>(null);

  // Automatic history recorder for user actions
  useEffect(() => {
    if (!degreeTemplate || isLoading) return;

    if (isHistoryOperationRef.current) {
      isHistoryOperationRef.current = false;
      return;
    }

    const currentSnapshot: PlanHistorySnapshot = {
      degreeTemplate: JSON.parse(JSON.stringify(degreeTemplate)),
      grades: { ...grades },
      classificationChecked: { ...classificationChecked },
      classificationCredits: { ...classificationCredits },
      binaryStates: { ...binaryStates },
      lockedSemesters: { ...lockedSemesters },
    };

    const serialized = JSON.stringify(currentSnapshot);
    if (lastRecordedSnapshotRef.current === null) {
      lastRecordedSnapshotRef.current = serialized;
      return;
    }

    if (serialized === lastRecordedSnapshotRef.current) {
      return;
    }

    // A change has occurred: push previous snapshot to undo stack
    try {
      const prevSnapshot = JSON.parse(lastRecordedSnapshotRef.current) as PlanHistorySnapshot;
      undoStackRef.current.push(prevSnapshot);
      if (undoStackRef.current.length > 50) {
        undoStackRef.current.shift();
      }
      redoStackRef.current = [];
      setCanUndo(true);
      setCanRedo(false);
      lastRecordedSnapshotRef.current = serialized;
    } catch {
      lastRecordedSnapshotRef.current = serialized;
    }
  }, [degreeTemplate, grades, classificationChecked, classificationCredits, binaryStates, lockedSemesters, isLoading]);

  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0 || !degreeTemplate) return;

    const previousSnapshot = undoStackRef.current.pop()!;
    const currentSnapshot: PlanHistorySnapshot = {
      degreeTemplate: JSON.parse(JSON.stringify(degreeTemplate)),
      grades: { ...grades },
      classificationChecked: { ...classificationChecked },
      classificationCredits: { ...classificationCredits },
      binaryStates: { ...binaryStates },
      lockedSemesters: { ...lockedSemesters },
    };

    redoStackRef.current.push(currentSnapshot);
    isHistoryOperationRef.current = true;
    lastRecordedSnapshotRef.current = JSON.stringify(previousSnapshot);

    setDegreeTemplate(previousSnapshot.degreeTemplate);
    setGrades(previousSnapshot.grades);
    setClassificationChecked(previousSnapshot.classificationChecked);
    setClassificationCredits(previousSnapshot.classificationCredits);
    setBinaryStates(previousSnapshot.binaryStates);
    setLockedSemesters(previousSnapshot.lockedSemesters || {});

    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(true);
  }, [degreeTemplate, grades, classificationChecked, classificationCredits, binaryStates, lockedSemesters]);

  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0 || !degreeTemplate) return;

    const nextSnapshot = redoStackRef.current.pop()!;
    const currentSnapshot: PlanHistorySnapshot = {
      degreeTemplate: JSON.parse(JSON.stringify(degreeTemplate)),
      grades: { ...grades },
      classificationChecked: { ...classificationChecked },
      classificationCredits: { ...classificationCredits },
      binaryStates: { ...binaryStates },
      lockedSemesters: { ...lockedSemesters },
    };

    undoStackRef.current.push(currentSnapshot);
    isHistoryOperationRef.current = true;
    lastRecordedSnapshotRef.current = JSON.stringify(nextSnapshot);

    setDegreeTemplate(nextSnapshot.degreeTemplate);
    setGrades(nextSnapshot.grades);
    setClassificationChecked(nextSnapshot.classificationChecked);
    setClassificationCredits(nextSnapshot.classificationCredits);
    setBinaryStates(nextSnapshot.binaryStates);
    setLockedSemesters(nextSnapshot.lockedSemesters || {});

    setCanUndo(true);
    setCanRedo(redoStackRef.current.length > 0);
  }, [degreeTemplate, grades, classificationChecked, classificationCredits, binaryStates, lockedSemesters]);

  // Keyboard shortcut listener: Ctrl+Z for undo, Ctrl+Y or Ctrl+Shift+Z for redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.key === 'Escape') {
        setSelectedNodes([]);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, setSelectedNodes]);

  const applyLoadedData = (
    template: DegreeTemplate | undefined,
    grades: Record<string, string>,
    checked: Record<string, boolean>,
    credits: Record<string, number>,
    binaries: Record<string, boolean>,
    globals: DegreeRule[]
  ) => {
    setDegreeTemplate(template ? fixSemesterOrdering(template) : undefined);
    setGrades(grades);
    setClassificationChecked(checked);
    setClassificationCredits(credits);
    setBinaryStates(binaries);
    setCurrentGlobalRules(globals);
    undoStackRef.current = [];
    redoStackRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
    lastRecordedSnapshotRef.current = null;
  };

  // Identify currently selected/highlighted course
  const selectedCourseNode = useMemo(() => {
    return selectedNodes.find(n => n.type === 'course') || null;
  }, [selectedNodes]);

  const selectedCourseId = selectedCourseNode?.id || null;

  const selectedCourseObj = useMemo(() => {
    if (!selectedCourseId) return null;
    return allCoursesData.find(c => c._id === selectedCourseId) || null;
  }, [selectedCourseId, allCoursesData]);

  // Find which semester the selected course belongs to and adjacent semesters
  const selectedCourseSemesterInfo = useMemo(() => {
    if (!selectedCourseId || !degreeTemplate?.semesters) return null;
    const sortedEntries = sortSemesterEntries(Object.entries(degreeTemplate.semesters));
    const idx = sortedEntries.findIndex(([, ids]) => ids.includes(selectedCourseId));
    if (idx === -1) return null;

    const currentSemKey = sortedEntries[idx][0];
    const prevSemKey = idx > 0 ? sortedEntries[idx - 1][0] : null;
    const nextSemKey = idx < sortedEntries.length - 1 ? sortedEntries[idx + 1][0] : null;

    const isCurrentLocked = Boolean(lockedSemesters[currentSemKey]);
    const isPrevLocked = Boolean(prevSemKey && lockedSemesters[prevSemKey]);
    const isNextLocked = Boolean(nextSemKey && lockedSemesters[nextSemKey]);

    return {
      semesterIndex: idx,
      semesterKey: currentSemKey,
      isCurrentLocked,
      isPrevLocked,
      isNextLocked,
      canMovePrev: idx > 0 && !isCurrentLocked && !isPrevLocked,
      prevSemesterKey: prevSemKey,
      canMoveNext: idx < sortedEntries.length - 1 && !isCurrentLocked && !isNextLocked,
      nextSemesterKey: nextSemKey,
      totalSemesters: sortedEntries.length,
    };
  }, [selectedCourseId, degreeTemplate?.semesters, lockedSemesters]);

  // Move selected course to previous or next semester
  const handleMoveSelectedCourse = useCallback((direction: 'prev' | 'next') => {
    if (!selectedCourseId || !degreeTemplate?.semesters || !selectedCourseSemesterInfo) return;

    const { semesterKey, canMovePrev, prevSemesterKey, canMoveNext, nextSemesterKey, isCurrentLocked } = selectedCourseSemesterInfo;
    if (isCurrentLocked || lockedSemesters[semesterKey]) return;

    const targetSemesterKey = direction === 'prev' ? (canMovePrev ? prevSemesterKey : null) : (canMoveNext ? nextSemesterKey : null);
    if (!targetSemesterKey || targetSemesterKey === semesterKey || lockedSemesters[targetSemesterKey]) return;

    setHasUserMadeChanges(true);
    setDegreeTemplate(prevTemplate => {
      if (!prevTemplate || typeof prevTemplate.semesters !== 'object') return prevTemplate;
      const updatedSemesters = { ...prevTemplate.semesters };
      const currentList = updatedSemesters[semesterKey] || [];
      const targetList = updatedSemesters[targetSemesterKey] || [];

      // Remove from source semester
      updatedSemesters[semesterKey] = currentList.filter(id => id !== selectedCourseId);
      // Append to target semester (if not already present)
      if (!targetList.includes(selectedCourseId)) {
        updatedSemesters[targetSemesterKey] = [...targetList, selectedCourseId];
      }

      return {
        ...prevTemplate,
        semesters: updatedSemesters
      };
    });

    // Keep the course selected after moving
    setPendingHighlightCourseId(selectedCourseId);
  }, [selectedCourseId, degreeTemplate?.semesters, selectedCourseSemesterInfo, lockedSemesters]);

  type PanelKey = 'electives' | 'recommendations' | 'oldPaths' | 'sports';

  const [panelSlots, setPanelSlots] = useState<Record<PanelKey, PanelSlot>>({
    electives: 1,        // Rightmost (Slot 1) by default
    recommendations: 4,  // Leftmost (Slot 4) by default
    oldPaths: 3,         // Mid-left (Slot 3) by default
    sports: 2,           // Mid-right (Slot 2) by default
  });

  const [openPanels, setOpenPanels] = useState<Record<PanelKey, boolean>>({
    electives: true,
    recommendations: true,
    oldPaths: false,
    sports: false,
  });

  // Switch slot for a panel; if occupied by another open panel, swap positions
  const handleSlotChange = useCallback((panel: PanelKey, targetSlot: PanelSlot) => {
    setPanelSlots(prev => {
      const currentSlot = prev[panel];
      if (currentSlot === targetSlot) return prev;

      // Find if another panel currently occupies targetSlot
      const otherPanel = (Object.keys(prev) as PanelKey[]).find(
        key => key !== panel && prev[key] === targetSlot
      );

      if (otherPanel) {
        // Swap slots between this panel and the conflicting panel
        return {
          ...prev,
          [panel]: targetSlot,
          [otherPanel]: currentSlot,
        };
      } else {
        return {
          ...prev,
          [panel]: targetSlot,
        };
      }
    });
  }, []);

  // Toggle a panel: when opening, if its slot is occupied, place in the nearest available slot (stacking from left or right)
  const togglePanel = useCallback((panel: PanelKey) => {
    setOpenPanels(prevOpen => {
      const willOpen = !prevOpen[panel];
      if (willOpen) {
        // Find which slots are currently occupied by open panels
        const occupiedSlots = new Set<PanelSlot>();
        (Object.keys(prevOpen) as PanelKey[]).forEach(k => {
          if (prevOpen[k] && k !== panel) {
            occupiedSlots.add(panelSlots[k]);
          }
        });

        // If this panel's slot is already occupied by an open panel, assign the first free slot
        if (occupiedSlots.has(panelSlots[panel])) {
          // Stacking order:
          // Electives prefers Slot 1 (far right), then 2, 3, 4
          // Others prefer Slot 4 (far left), then 3, 2, 1
          const preferenceOrder: PanelSlot[] = panel === 'electives' 
            ? [1, 2, 3, 4] 
            : [4, 3, 2, 1];
          
          const freeSlot = preferenceOrder.find(s => !occupiedSlots.has(s)) ?? 4;

          setPanelSlots(prevSlots => {
            const currentSlot = prevSlots[panel];
            const conflict = (Object.keys(prevSlots) as PanelKey[]).find(
              k => k !== panel && prevSlots[k] === freeSlot
            );
            if (conflict) {
              return {
                ...prevSlots,
                [panel]: freeSlot,
                [conflict]: currentSlot,
              };
            }
            return {
              ...prevSlots,
              [panel]: freeSlot,
            };
          });
        }
      }
      return {
        ...prevOpen,
        [panel]: willOpen,
      };
    });
  }, [panelSlots]);

  const handleSelectTemplate = useCallback(async (selectedTemplate: DegreeTemplate, selectedYear?: string) => {
    if (selectedYear) {
      const yearCourses = await fetchAllCourses(selectedYear);
      if (yearCourses.length > 0) {
        setAllCoursesData(yearCourses);
      }
    }
    applyLoadedData(
      selectedTemplate,
      {}, // reset grades
      {}, // reset classificationChecked
      {}, // reset classificationCredits
      {}, // reset binaryStates
      currentGlobalRules // keep global rules
    );
    setShowTemplateSelection(false);
    // Trigger save
    setSaveStatus('saving');
    localStorage.setItem('hasSelectedTemplate', 'true');
  }, [currentGlobalRules]);

  const showAlertMessage = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', title?: string) => {
    setAlertConfig({ message, type, title });
    setShowAlert(true);
  };

  const isMechanicalEngineering = Boolean(
    degreeTemplate?.id?.startsWith('mechanical-engineering') ||
    degreeTemplate?.name?.includes('הנדסת מכונות')
  );

  const meSpecializationPaths = useMemo(() => {
    const fromAll = allTemplatesData?.['mechanical-engineering-general']?.['specialization-paths'];
    if (fromAll && fromAll.length > 0) return fromAll;
    return degreeTemplate?.['specialization-paths'] || [];
  }, [allTemplatesData, degreeTemplate?.['specialization-paths']]);

  const effectiveCourseLists = useMemo(() => {
    const baseLists = allTemplatesData?.['mechanical-engineering-general']?.['courses-lists'] || {};
    const currentLists = degreeTemplate?.['courses-lists'] || {};
    return {
      ...baseLists,
      ...currentLists,
    };
  }, [allTemplatesData, degreeTemplate?.['courses-lists']]);

  const handleLoadPlanFromSlot = useCallback((slot: PlanSlot) => {
    if (!slot.plan || !slot.plan.template) return;
    applyLoadedData(
      slot.plan.template,
      slot.plan.grades || {},
      slot.plan.classificationChecked || {},
      slot.plan.classificationCredits || {},
      slot.plan.binaryStates || {},
      currentGlobalRules
    );
    if (slot.plan.lockedSemesters) {
      setLockedSemesters(slot.plan.lockedSemesters);
    }
    setActiveSlotIdState(slot.id);
    showAlertMessage(`התוכנית נטענה בהצלחה מסלוט "${slot.name}"!`, 'success', 'טעינת גרסת תוכנית');
  }, [applyLoadedData, currentGlobalRules]);

  const handleConfirmResetPlan = useCallback(async () => {
    let source = allTemplatesData;
    if (!source || Object.keys(source).length === 0) {
      source = await fetchDegreeTemplates();
    }
    if (!source || Object.keys(source).length === 0) {
      source = getDefaultDegreesData();
    }
    const defaultTmpl =
      source?.['mechanical-engineering-general'] ||
      (degreeTemplate?.id && source?.[degreeTemplate.id]) ||
      getDefaultDegreesData()['mechanical-engineering-general'] ||
      Object.values(source || {})[0];
    if (defaultTmpl && defaultTmpl.semesters) {
      setDegreeTemplate(prev => {
        if (!prev) return defaultTmpl;
        const restored = {
          ...prev,
          semesters: JSON.parse(JSON.stringify(defaultTmpl.semesters)),
          rules: (defaultTmpl.rules && defaultTmpl.rules.length > 0) ? defaultTmpl.rules : prev.rules,
        };
        if (!(SEMESTER_0_NAME in restored.semesters)) {
          restored.semesters = { [SEMESTER_0_NAME]: ['bonus_credits'], ...restored.semesters };
        }
        return restored;
      });
      setHasUserMadeChanges(true);
      setSelectedNodes([]);
      showAlertMessage('תוכנית הלימודים שוחזרה בהצלחה לפי קורסי החובה המקוריים של הסילבוס!', 'success', 'שחזור קורסי תוכנית');
    }
    setShowResetPlanConfirm(false);
  }, [allTemplatesData, degreeTemplate?.id]);

  const currentPlanForSlot = useMemo<StoredPlan>(() => ({
    template: degreeTemplate || ({} as DegreeTemplate),
    grades,
    classificationChecked,
    classificationCredits,
    binaryStates,
    lockedSemesters,
    timestamp: Date.now(),
    lastSaved: new Date().toISOString(),
  }), [degreeTemplate, grades, classificationChecked, classificationCredits, binaryStates, lockedSemesters]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      {/* Top-left: Logo */}
      <div className="fixed top-4 left-4 z-50 items-center gap-2 flex flex-row-reverse bg-slate-50/60 dark:bg-gray-800/60 rounded-lg shadow-md backdrop-blur-sm p-2">
        <Logo />
      </div>

      {/* Top-center: Credits & Vibe-Coded Disclaimer */}
      <CreditsBanner />
      
      {/* Top-right: Save Status, Undo/Redo and Profile */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2.5 bg-slate-50/80 dark:bg-gray-800/80 rounded-lg shadow-md backdrop-blur-sm p-2">
        <AuthButtons
          currentUser={currentUser}
          onSignIn={() => setShowSignInConfirm(true)}
          onSignOut={async () => { await signOut(); }}
          onExportPlan={handleExportPlan}
          onImportPlan={handleImportPlan}
          onSwitchTemplate={() => setShowSwitchConfirm(true)}
        />
        {/* Multi-slot Plan Selector */}
        <button
          type="button"
          onClick={() => setIsPlanSlotsModalOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/70 dark:hover:bg-blue-900/70 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100 text-xs font-bold transition-all shadow-sm"
          title="גרסאות תוכנית לימודים (סלוטים וסנכרון ענן)"
        >
          <span>💾 סלוט {activeSlotId.replace('slot_', '')}</span>
          <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 rounded font-black">
            ניהול
          </span>
        </button>
        {/* Export to PDF / High-Res Image */}
        <button
          type="button"
          onClick={() => setIsExportMapModalOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/70 dark:hover:bg-emerald-900/70 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 text-xs font-bold transition-all shadow-sm"
          title="ייצוא מפת הלימודים ל-PDF או לתמונה ברזולוציה גבוהה"
        >
          <span>📄</span>
          <span className="hidden sm:inline">ייצוא PDF / תמונה</span>
        </button>
        <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />
        <div className="flex items-center gap-1 bg-white/70 dark:bg-gray-700/70 p-0.5 rounded-lg border border-gray-200/80 dark:border-gray-600">
          <button
            type="button"
            disabled={!canUndo}
            onClick={handleUndo}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition-all ${
              canUndo
                ? 'text-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-95'
                : 'text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-40'
            }`}
            title="ביטול פעולה אחרונה (Ctrl+Z)"
          >
            <span>↩️</span>
            <span className="hidden md:inline text-[11px]">ביטול</span>
          </button>
          <div className="w-px h-3.5 bg-gray-300 dark:bg-gray-600" />
          <button
            type="button"
            disabled={!canRedo}
            onClick={handleRedo}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition-all ${
              canRedo
                ? 'text-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-95'
                : 'text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-40'
            }`}
            title="שחזור / ביצוע שוב (Ctrl+Y / Ctrl+Shift+Z)"
          >
            <span>↪️</span>
            <span className="hidden md:inline text-[11px]">שחזור</span>
          </button>
        </div>
        <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />
        <div className="flex items-center justify-center min-w-[50px] text-center p-1">
          {saveStatus === 'saving' && <span className="text-xs text-slate-600 dark:text-slate-300 p-1 bg-slate-200 dark:bg-slate-700 rounded">שומר...</span>}
          {saveStatus === 'saved' && <span className="text-xs text-green-600 dark:text-green-400 p-1 bg-green-100 dark:bg-green-800 rounded">נשמר ✓</span>}
        </div>
        <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />
        <button
          type="button"
          onClick={() => setIsHelpModalOpen(true)}
          className="flex items-center justify-center w-7 h-7 rounded-lg text-sm font-extrabold bg-white/80 dark:bg-gray-700/80 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-gray-200 dark:border-gray-600 shadow-sm transition-all active:scale-95"
          title="מדריך למשתמש ופירוט תכונות (?)"
        >
          ?
        </button>
      </div>

      {/* 4 Dockable Sidebars (can all be open simultaneously without conflict) */}
      {isMechanicalEngineering && (
        <>
          <ElectiveListsSidebar
            courseLists={effectiveCourseLists}
            rules={degreeTemplate?.rules}
            allCourses={allCoursesData}
            semesters={degreeTemplate?.semesters}
            selectedCourseIds={new Set(selectedNodes.filter(n => n.type === 'course').map(n => n.id))}
            onCourseClick={handleSidebarCourseClick}
            onCourseInfoClick={handleSidebarCourseInfoClick}
            onCourseRemoveClick={handleRemoveCourseCallback}
            isOpen={openPanels.electives}
            onToggleOpen={() => togglePanel('electives')}
            hideFloatingButton={true}
            slot={panelSlots.electives}
            onSlotChange={s => handleSlotChange('electives', s)}
          />

          <SpecializationPathsSidebar
            paths={meSpecializationPaths}
            allCourses={allCoursesData}
            semesters={degreeTemplate?.semesters}
            selectedCourseIds={new Set(selectedNodes.filter(n => n.type === 'course').map(n => n.id))}
            onCourseClick={handleSidebarCourseClick}
            onCourseInfoClick={handleSidebarCourseInfoClick}
            onCourseRemoveClick={handleRemoveCourseCallback}
            isOpen={openPanels.recommendations}
            onToggleOpen={() => togglePanel('recommendations')}
            hideFloatingButton={true}
            title="🧭 המלצות נתיבי התמחות"
            colorScheme="emerald"
            slot={panelSlots.recommendations}
            onSlotChange={s => handleSlotChange('recommendations', s)}
            comparisonPaths={OLD_SPECIALIZATION_PATHS}
            comparisonBadgeLabel="זהה לנתיבי התמחות הישנים"
          />

          <SpecializationPathsSidebar
            paths={OLD_SPECIALIZATION_PATHS}
            allCourses={allCoursesData}
            semesters={degreeTemplate?.semesters}
            selectedCourseIds={new Set(selectedNodes.filter(n => n.type === 'course').map(n => n.id))}
            onCourseClick={handleSidebarCourseClick}
            onCourseInfoClick={handleSidebarCourseInfoClick}
            onCourseRemoveClick={handleRemoveCourseCallback}
            isOpen={openPanels.oldPaths}
            onToggleOpen={() => togglePanel('oldPaths')}
            hideFloatingButton={true}
            title="📜 נתיבי התמחות ישנים"
            notice="נתיבי התמחות שבעבר היה צריך לקחת, אין צורך בבחירה כזאת, כמו ההמלצת נתיבי התמחות, אפשר להשתמש ברשימות הללו כהמלצה."
            colorScheme="purple"
            slot={panelSlots.oldPaths}
            onSlotChange={s => handleSlotChange('oldPaths', s)}
            comparisonPaths={meSpecializationPaths}
            comparisonBadgeLabel="זהה להמלצות"
          />
        </>
      )}

      {/* Sports & Malag Sidebar */}
      <SportsCoursesSidebar
        allCourses={allCoursesData}
        semesters={degreeTemplate?.semesters}
        selectedCourseIds={new Set(selectedNodes.filter(n => n.type === 'course').map(n => n.id))}
        onCourseClick={handleSidebarCourseClick}
        onCourseInfoClick={handleSidebarCourseInfoClick}
        onCourseRemoveClick={handleRemoveCourseCallback}
        isOpen={openPanels.sports}
        onToggleOpen={() => togglePanel('sports')}
        hideFloatingButton={true}
        slot={panelSlots.sports}
        onSlotChange={s => handleSlotChange('sports', s)}
      />

      {/* Bottom HUD Bar (Responsive wrap bar for dock toggles and course shift controls) */}
      <div
        dir="rtl"
        className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 flex flex-wrap items-center justify-center gap-2 max-w-[96vw] px-3 py-1.5 rounded-xl bg-slate-900/90 dark:bg-gray-900/95 border border-gray-700/70 shadow-2xl backdrop-blur-md"
      >
        {isMechanicalEngineering && (
          <>
            <button
              type="button"
              onClick={() => togglePanel('electives')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg shadow-md text-white text-xs font-semibold transition-all duration-200 whitespace-nowrap ${
                openPanels.electives
                  ? 'bg-blue-600 hover:bg-blue-700 ring-2 ring-blue-300/70'
                  : 'bg-blue-600/80 hover:bg-blue-600 opacity-85'
              }`}
              title={`רשימות בחירה לתואר (עמדה ${panelSlots.electives}) - לחץ לפתיחה/סגירה`}
            >
              <span>📚 רשימות בחירה לתואר</span>
              <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded">
                [{panelSlots.electives}] {openPanels.electives ? '▼' : '▲'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => togglePanel('recommendations')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg shadow-md text-white text-xs font-semibold transition-all duration-200 whitespace-nowrap ${
                openPanels.recommendations
                  ? 'bg-emerald-600 hover:bg-emerald-700 ring-2 ring-emerald-300/70'
                  : 'bg-emerald-600/80 hover:bg-emerald-600 opacity-85'
              }`}
              title={`המלצות נתיבי התמחות (עמדה ${panelSlots.recommendations}) - לחץ לפתיחה/סגירה`}
            >
              <span>🧭 המלצות נתיבי התמחות ({meSpecializationPaths?.length || 14})</span>
              <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded">
                [{panelSlots.recommendations}] {openPanels.recommendations ? '▼' : '▲'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => togglePanel('oldPaths')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg shadow-md text-white text-xs font-semibold transition-all duration-200 whitespace-nowrap ${
                openPanels.oldPaths
                  ? 'bg-purple-600 hover:bg-purple-700 ring-2 ring-purple-300/70'
                  : 'bg-purple-600/80 hover:bg-purple-600 opacity-85'
              }`}
              title={`נתיבי התמחות ישנים (עמדה ${panelSlots.oldPaths}) - לחץ לפתיחה/סגירה`}
            >
              <span>📜 נתיבי התמחות ישנים ({OLD_SPECIALIZATION_PATHS.length})</span>
              <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded">
                [{panelSlots.oldPaths}] {openPanels.oldPaths ? '▼' : '▲'}
              </span>
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => togglePanel('sports')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg shadow-md text-white text-xs font-semibold transition-all duration-200 whitespace-nowrap ${
            openPanels.sports
              ? 'bg-orange-600 hover:bg-orange-700 ring-2 ring-orange-300/70'
              : 'bg-orange-600/85 hover:bg-orange-600 opacity-90'
          }`}
          title={`קורסי ספורט, מל"ג ונבחרות אס"א (עמדה ${panelSlots.sports}) - לחץ לפתיחה/סגירה`}
        >
          <span>🏃 ספורט ומל"ג</span>
          <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded">
            [{panelSlots.sports}] {openPanels.sports ? '▼' : '▲'}
          </span>
        </button>

        {degreeTemplate?.semesters && !(SEMESTER_0_NAME in degreeTemplate.semesters) && (
          <button
            type="button"
            onClick={handleAddSemester0Callback}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg shadow-md text-white text-xs font-semibold bg-teal-600/90 hover:bg-teal-600 transition-all duration-200 whitespace-nowrap"
            title="הוסף סמסטר 0 (פטורים וקורסים שנעשו קודם לסטודנטים במעבר)"
          >
            <span>➕ סמסטר 0 (פטורים/עבר)</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setShowResetPlanConfirm(true)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg shadow-md text-white text-xs font-semibold bg-amber-600/90 hover:bg-amber-600 transition-all duration-200 whitespace-nowrap"
          title="שחזר את כל קורסי החובה של הסילבוס (במידה וקורסים נמחקו או נעלמו)"
        >
          <span>🔄 שחזר קורסי תוכנית</span>
        </button>

        {/* Undo and Redo Controls */}
        <div className="flex items-center gap-0.5 bg-gray-800/90 border border-gray-700/80 px-1 py-0.5 rounded-lg">
          <button
            type="button"
            disabled={!canUndo}
            onClick={handleUndo}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition-all ${
              canUndo
                ? 'text-gray-100 hover:bg-gray-700 active:scale-95'
                : 'text-gray-500 cursor-not-allowed opacity-40'
            }`}
            title="ביטול פעולה אחרונה (Ctrl+Z)"
          >
            <span>↩️ ביטול</span>
          </button>
          <div className="w-px h-3.5 bg-gray-600" />
          <button
            type="button"
            disabled={!canRedo}
            onClick={handleRedo}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition-all ${
              canRedo
                ? 'text-gray-100 hover:bg-gray-700 active:scale-95'
                : 'text-gray-500 cursor-not-allowed opacity-40'
            }`}
            title="שחזור / ביצוע שוב (Ctrl+Y)"
          >
            <span>↪️ שחזור</span>
          </button>
        </div>

        {/* Help Modal Toggle Button */}
        <button
          type="button"
          onClick={() => setIsHelpModalOpen(true)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg shadow-md text-white text-xs font-semibold bg-blue-600/90 hover:bg-blue-600 transition-all duration-200 whitespace-nowrap"
          title="מדריך למשתמש ושאלות נפוצות (?)"
        >
          <span>❓ מדריך</span>
        </button>

        {/* Course movement controls (appears when a course is highlighted/selected) */}
        {selectedCourseSemesterInfo && (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-indigo-950/85 border border-indigo-500/60 shadow-lg text-white text-xs">
            <div className="flex items-center gap-1.5 max-w-[170px] truncate" title={`${selectedCourseObj?.name || selectedCourseId} (${selectedCourseId})`}>
              <span className="text-amber-300 font-bold">📌</span>
              <span className="font-semibold text-indigo-100 truncate">
                {selectedCourseObj?.name || selectedCourseId}
              </span>
            </div>
            <span className="text-[11px] text-indigo-200 bg-indigo-900/60 px-1.5 py-0.5 rounded border border-indigo-700/50 whitespace-nowrap">
              {selectedCourseSemesterInfo.semesterKey}
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={!selectedCourseSemesterInfo.canMovePrev}
                onClick={() => handleMoveSelectedCourse('prev')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-semibold transition-all whitespace-nowrap ${
                  selectedCourseSemesterInfo.canMovePrev
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow hover:shadow-indigo-500/30 active:scale-95'
                    : 'bg-gray-800/80 text-gray-500 cursor-not-allowed opacity-50'
                }`}
                title={
                  selectedCourseSemesterInfo.isCurrentLocked
                    ? `לא ניתן להזיז קורס מתוך ${selectedCourseSemesterInfo.semesterKey} (סמסטר נעול 🔒)`
                    : selectedCourseSemesterInfo.isPrevLocked
                    ? `לא ניתן להעביר ל-${selectedCourseSemesterInfo.prevSemesterKey} (סמסטר נעול 🔒)`
                    : selectedCourseSemesterInfo.canMovePrev
                    ? `העבר אחורה ל-${selectedCourseSemesterInfo.prevSemesterKey}`
                    : 'הקורס כבר נמצא בסמסטר הראשון (אין סמסטר קודם)'
                }
              >
                <span>סמסטר קודם ▶</span>
              </button>

              <button
                type="button"
                disabled={!selectedCourseSemesterInfo.canMoveNext}
                onClick={() => handleMoveSelectedCourse('next')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-semibold transition-all whitespace-nowrap ${
                  selectedCourseSemesterInfo.canMoveNext
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow hover:shadow-indigo-500/30 active:scale-95'
                    : 'bg-gray-800/80 text-gray-500 cursor-not-allowed opacity-50'
                }`}
                title={
                  selectedCourseSemesterInfo.isCurrentLocked
                    ? `לא ניתן להזיז קורס מתוך ${selectedCourseSemesterInfo.semesterKey} (סמסטר נעול 🔒)`
                    : selectedCourseSemesterInfo.isNextLocked
                    ? `לא ניתן להעביר ל-${selectedCourseSemesterInfo.nextSemesterKey} (סמסטר נעול 🔒)`
                    : selectedCourseSemesterInfo.canMoveNext
                    ? `העבר קדימה ל-${selectedCourseSemesterInfo.nextSemesterKey}`
                    : 'הקורס נמצא בסמסטר האחרון (הוסף סמסטר כדי להעביר הלאה)'
                }
              >
                <span>◀ סמסטר הבא</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange as OnNodesChange<Node>}
          onEdgesChange={onEdgesChange as OnEdgesChange<Edge>}
          onSelectionChange={handleSelectionChange}
          onPaneClick={() => setSelectedNodes([])}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="top-right"
          colorMode={theme}
          nodesDraggable={false}
          nodesConnectable={false}
          selectNodesOnDrag={false}
          zoomOnDoubleClick={false}
          onNodeDoubleClick={handleNodeDoubleClick as NodeMouseHandler<Node>}
          onNodeClick={handleNodeClick as NodeMouseHandler<Node>}
        >
          <Controls />
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        </ReactFlow>
      </ReactFlowProvider>
      <CourseSelectionModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        courses={availableCoursesForModal}
        onSelectCourse={handleSelectCourseFromModal}
        semesterNumber={semesterToAddCourseTo}
        alreadyTakenCourses={alreadyTakenCoursesForModal}
      />
      {courseDetailModalData && courseDetailModalData.course && (
        <CourseDetailModal
          isOpen={!!courseDetailModalData}
          onClose={() => {
            setCourseDetailModalData(null);
          }}
          course={courseDetailModalData.course}
          allCourses={allCoursesData}
          coursesInPlanIds={courseDetailModalData.coursesInPlanIds}
          semesters={courseDetailModalData.semesters}
          targetCourseSemesterKey={courseDetailModalData.targetCourseSemesterKey}
        />
      )}
      <RuleEditorModal
        isOpen={isRuleEditorOpen}
        rule={editingRule}
        onClose={handleCloseRuleEditor}
        onSave={handleSaveRule}
        availableCourseListNames={degreeTemplate && degreeTemplate["courses-lists"] ? Object.keys(degreeTemplate["courses-lists"]) : []}
      />
      <CourseListEditorModal
        isOpen={isCourseListEditorOpen}
        onClose={handleToggleCourseListEditorModal}
        allCourses={allCoursesData}
        currentCourseLists={useMemo(() => {
          const lists = { ...(degreeTemplate?.["courses-lists"] || {}) };
          if (degreeTemplate && degreeTemplate.definedMandatoryCourseIds) {
            lists[MANDATORY_COURSES_LIST_KEY] = [...new Set(degreeTemplate.definedMandatoryCourseIds)];
          } else if (degreeTemplate && typeof degreeTemplate.semesters === 'object' && degreeTemplate.semesters !== null) {
             const allMandatoryIdsFromSemesters = [...new Set(Object.values(degreeTemplate.semesters).flat())];
             lists[MANDATORY_COURSES_LIST_KEY] = allMandatoryIdsFromSemesters;
          } else {
            lists[MANDATORY_COURSES_LIST_KEY] = [];
          }
          return lists;
        }, [degreeTemplate])}
        onSaveCourseLists={handleSaveCourseLists}
        referencedCourseListNames={getReferencedCourseListNames(degreeTemplate?.rules)}
        mandatoryCoursesListKey={MANDATORY_COURSES_LIST_KEY}
      />
      <ConsolidatedRuleEditorModal
        isOpen={isConsolidatedRuleEditorOpen}
        rules={rulesForConsolidatedEditing}
        onClose={() => {
          setIsConsolidatedRuleEditorOpen(false);
          setRulesForConsolidatedEditing([]);
        }}
        onSave={handleSaveConsolidatedRules}
      />
      <TemplateSelectionModal
        isOpen={showTemplateSelection}
        onClose={() => setShowTemplateSelection(false)}
        templates={Object.values(allTemplatesData || {})}
        onSelectTemplate={handleSelectTemplate}
        isSwitching={isSwitchingTemplate}
        customTitle={isSwitchingTemplate ? 'החלף תכנית לימודים' : 'בחר תכנית לימודים ראשונית'}
        onExport={handleExportPlan}
      />
      <HelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />
      <ConfirmModal
        isOpen={showSwitchConfirm}
        onClose={() => setShowSwitchConfirm(false)}
        message="החלפת תכנית תמחק את התכנית הנוכחית. האם לייצא קודם?"
        onConfirm={() => {
          setIsSwitchingTemplate(true);
          setShowTemplateSelection(true);
        }}
        confirmText="המשך ללא ייצוא"
        onExport={handleExportPlan}
      />
      <ConfirmModal
        isOpen={showSignInConfirm}
        onClose={() => setShowSignInConfirm(false)}
        message="התחברות תטען את התכנית מהענן, מה שעשוי למחוק שינויים מקומיים. האם לייצא קודם?"
        onConfirm={async () => { await signInWithGoogle(); }}
        onExport={handleExportPlan}
        confirmText="המשך ללא ייצוא"
      />
      <ConfirmModal
        isOpen={showResetPlanConfirm}
        onClose={() => setShowResetPlanConfirm(false)}
        message="האם לשחזר את כל קורסי החובה של התוכנית המקורית לפי הסילבוס? פעולה זו תחזיר את הקורסים לכל הסמסטרים (הציונים והפטורים שצברת יישמרו)."
        onConfirm={handleConfirmResetPlan}
        confirmText="שחזר קורסים"
      />
      <PlanSlotsModal
        isOpen={isPlanSlotsModalOpen}
        onClose={() => setIsPlanSlotsModalOpen(false)}
        activeSlotId={activeSlotId}
        currentPlanData={currentPlanForSlot}
        onLoadPlanFromSlot={handleLoadPlanFromSlot}
        onActiveSlotChange={setActiveSlotIdState}
        currentUser={currentUser}
        onSignInWithGoogle={() => setShowSignInConfirm(true)}
        onSignOut={async () => { await signOut(); }}
      />
      <ExportPlanModal
        isOpen={isExportMapModalOpen}
        onClose={() => setIsExportMapModalOpen(false)}
        degreeTemplate={degreeTemplate}
        allCourses={allCoursesData}
        grades={grades}
        lockedSemesters={lockedSemesters}
      />
      <ConfirmModal
        isOpen={showDeleteSemesterConfirm}
        onClose={() => {
          setShowDeleteSemesterConfirm(false);
          setSemesterToDelete(null);
        }}
        message={`האם אתה בטוח שברצונך למחוק את ${semesterToDelete}?`}
        onConfirm={() => {
          if (semesterToDelete) {
            setDegreeTemplate(prevTemplate => {
              if (!prevTemplate || typeof prevTemplate.semesters !== 'object') return prevTemplate;
              const updatedSemesters = { ...prevTemplate.semesters };
              delete updatedSemesters[semesterToDelete];
              const newTemplate = { ...prevTemplate, semesters: updatedSemesters };
              if (import.meta.env.DEV) {
                console.log(`DegreePlanView: Semester ${semesterToDelete} removed. Updated template:`, newTemplate);
                console.log(`DegreePlanView: Remaining semesters:`, Object.keys(updatedSemesters));
              }
              return newTemplate;
            });
          }
          setShowDeleteSemesterConfirm(false);
          setSemesterToDelete(null);
        }}
        confirmText="מחק בכל זאת"
        confirmVariant="danger"
      />
      <AlertModal
        isOpen={showAlert}
        onClose={() => setShowAlert(false)}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttonText={alertConfig.buttonText}
      />
      <ConfirmModal
        isOpen={showDeleteRuleConfirm}
        onClose={() => {
          setShowDeleteRuleConfirm(false);
          setRuleToDelete(null);
        }}
        title="מחיקת כלל"
        message="האם אתה בטוח שברצונך למחוק כלל זה?"
        confirmText="מחק"
        confirmVariant="danger"
        onConfirm={() => {
          if (ruleToDelete) {
            setDegreeTemplate(prevTemplate => {
              if (!prevTemplate || !prevTemplate.rules) return prevTemplate;
              const updatedRules = prevTemplate.rules.filter(r => r.id !== ruleToDelete);
              return { ...prevTemplate, rules: updatedRules };
            });
          }
          setShowDeleteRuleConfirm(false);
          setRuleToDelete(null);
        }}
      />
      <ConfirmModal
        isOpen={showImportConfirm}
        onClose={() => {
          setShowImportConfirm(false);
          setImportData(null);
        }}
        title="ייבוא תוכנית"
        message={importData ? `האם אתה בטוח שברצונך לייבא את התוכנית "${importData.degreeTemplate?.name || 'לא ידוע'}" מתאריך ${importData.exportDate ? new Date(importData.exportDate).toLocaleDateString('he-IL') : 'לא ידוע'}?\nפעולה זו תחליף את התוכנית הנוכחית.` : ''}
        confirmText="ייבא"
        confirmVariant="primary"
        onConfirm={() => {
          if (importData && importData.degreeTemplate) {
            setHasUserMadeChanges(true);
            setDegreeTemplate(fixSemesterOrdering(importData.degreeTemplate));
            setGrades(importData.grades || {});
            setClassificationChecked(importData.classificationChecked || {});
            setClassificationCredits(importData.classificationCredits || {});
            setBinaryStates(importData.binaryStates || {});
            savePlan(
              importData.degreeTemplate,
              importData.grades || {},
              importData.classificationChecked || {},
              importData.classificationCredits || {},
              importData.binaryStates || {}
            );
            
            showAlertMessage(`התוכנית "${importData.degreeTemplate?.name || 'לא ידוע'}" יובאה בהצלחה!`, 'success');
          }
          setShowImportConfirm(false);
          setImportData(null);
        }}
      />

      {/* Sync Rules Template Selection Modal */}
      <TemplateSelectionModal
        isOpen={showSyncTemplateSelection}
        onClose={() => setShowSyncTemplateSelection(false)}
        templates={Object.values(allTemplatesData || {})}
        onSelectTemplate={(template: DegreeTemplate) => {
          setSelectedSyncTemplate(template);
          setShowSyncTemplateSelection(false);
          setShowSyncRulesConfirm(true);
        }}
        isSwitching={false}
        customTitle="בחר תכנית לסנכרון כללים"
        onExport={handleExportPlan}
      />

      {/* Sync Rules Confirmation Modal */}
      <ConfirmModal
        isOpen={showSyncRulesConfirm}
        onClose={() => setShowSyncRulesConfirm(false)}
        message="סנכרון הכללים ירשום מחדש את כל הכללים והרשימות מהתכנית שנבחרה, אך ישמור על הקורסים בסמסטרים. האם להמשיך?"
        onConfirm={handleConfirmSyncRules}
        onExport={handleExportPlan}
        confirmText="המשך ללא ייצוא"
      />
    </div>
  );
}

export default DegreePlanView;
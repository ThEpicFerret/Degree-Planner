import React, { useState } from 'react';
import BaseModal from './BaseModal';
import { DegreeTemplate, RawCourseData, DegreeRule } from '../../types/data';
import { sortSemesterEntries, SEMESTER_0_NAME } from '../../utils/hebrewUtils';
import { calculateAllAverages } from '../../utils/averageCalculator';
import { calculateAllWeeklyHours } from '../../utils/hoursCalculator';
import { evaluateRule } from '../../utils/ruleEvaluator';

interface ExportPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  degreeTemplate?: DegreeTemplate;
  allCourses: RawCourseData[];
  grades: Record<string, string>;
  lockedSemesters?: Record<string, boolean>;
  classificationCredits?: Record<string, number>;
  classificationChecked?: Record<string, boolean>;
  globalRules?: DegreeRule[];
  binaryStates?: Record<string, boolean>;
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 0 && ctx.measureText(truncated + '...').width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated ? truncated + '...' : '';
}

function drawProgressBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  percentDone: number,
  percentPlanned: number
) {
  const done = Math.max(0, Math.min(100, percentDone));
  const planned = Math.max(0, Math.min(100 - done, percentPlanned));

  // Background track
  ctx.fillStyle = '#334155'; // slate-700
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, height / 2);
  ctx.fill();

  // In RTL, "Done" starts from right edge
  const doneWidth = (done / 100) * width;
  const plannedWidth = (planned / 100) * width;

  if (doneWidth > 0) {
    ctx.fillStyle = '#22c55e'; // green-500
    ctx.beginPath();
    ctx.roundRect(x + width - doneWidth, y, doneWidth, height, height / 2);
    ctx.fill();
  }

  if (plannedWidth > 0) {
    ctx.fillStyle = '#eab308'; // yellow-500
    ctx.beginPath();
    ctx.roundRect(x + width - doneWidth - plannedWidth, y, plannedWidth, height, height / 2);
    ctx.fill();
  }
}

export const ExportPlanModal: React.FC<ExportPlanModalProps> = ({
  isOpen,
  onClose,
  degreeTemplate,
  allCourses,
  grades,
  classificationCredits,
  classificationChecked,
  globalRules,
  binaryStates,
}) => {
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const handleExportHighResImage = async () => {
    if (!degreeTemplate || !degreeTemplate.semesters) return;
    setIsExportingImage(true);
    setExportStatus('מייצר תמונה ברזולוציה גבוהה הכוללת את כל לוחות הסיכום והסמסטרים...');

    try {
      // 1. Calculate bonus credits and effective course catalog including synthetic bonus course
      const bonusPts = typeof classificationCredits?.['bonus_credits'] === 'number'
        ? classificationCredits['bonus_credits']
        : (Object.values(degreeTemplate.semesters).flat().includes('bonus_credits') ? 2.5 : 0);

      const effectiveAllCourses: RawCourseData[] = [
        ...allCourses.filter(c => c._id !== 'bonus_credits'),
        {
          _id: 'bonus_credits',
          name: 'בונוסים',
          credits: bonusPts,
          hours: '',
          prereqTree: undefined,
          semesters: [],
          isClassificationCourse: false,
        } as unknown as RawCourseData
      ];

      const allCourseIdsInTemplate = Object.values(degreeTemplate.semesters).flat();
      const coursesInCurrentPlan = allCourseIdsInTemplate
        .map(cid => effectiveAllCourses.find(c => c._id === cid || c._id === cid.replace(/^0+/, '') || ('0' + c._id) === cid))
        .filter(Boolean) as RawCourseData[];

      const sortedSemesters = sortSemesterEntries(Object.entries(degreeTemplate.semesters));
      const { overallAverage, semesterCalculations } = calculateAllAverages(degreeTemplate, effectiveAllCourses, grades);
      const { overallTotalHours, overallAverageHours, semesterCalculations: weeklyHoursCalculations } = calculateAllWeeklyHours(degreeTemplate, effectiveAllCourses);

      const totalPlannedCredits = Object.values(semesterCalculations).reduce((sum, calc) => sum + calc.totalCredits, 0);
      const degreeRequiredCredits = degreeTemplate.total_credits || 155.5;

      // 2. Prepare rule evaluations for top dashboard
      const templateRules = degreeTemplate.rules || [];
      const consolidatedRuleTypes = new Set([
        'total_credits', 'credits_from_list', 'min_grade', 'minCredits',
        'minCoursesFromList', 'minCreditsFromMandatory', 'minCreditsFromAnySelectiveList', 'minCreditsFromIdPattern'
      ]);

      const consolidatedRules = templateRules.filter(r => r.type !== 'classification_courses' && consolidatedRuleTypes.has(r.type));
      const consolidatedEvaluated = consolidatedRules.map(rule => {
        const status = evaluateRule(
          rule,
          coursesInCurrentPlan,
          grades,
          binaryStates || {},
          degreeTemplate['courses-lists'],
          degreeTemplate.definedMandatoryCourseIds,
          classificationChecked || {},
          classificationCredits || {}
        );
        return {
          id: rule.id,
          description: rule.description || `חוק ${rule.type}`,
          currentProgress: status.currentProgressString,
          isSatisfied: status.isSatisfied,
          currentValuePlanned: status.currentValuePlanned ?? undefined,
          currentValueDone: status.currentValueDone ?? undefined,
          requiredValue: status.requiredValue ?? undefined,
        };
      });

      // Selective lists rule
      const selectiveListRule = templateRules.find(r => r.type === 'minCoursesFromMultipleLists' || r.description?.includes('מרשימות בחירה'));
      let selectiveListDetails: Array<{
        listName: string;
        currentValuePlanned: number;
        currentValueDone: number;
        requiredValue: number;
        isSatisfied: boolean;
        unit?: string;
      }> = [];

      if (selectiveListRule) {
        const status = evaluateRule(
          selectiveListRule,
          coursesInCurrentPlan,
          grades,
          binaryStates || {},
          degreeTemplate['courses-lists'],
          degreeTemplate.definedMandatoryCourseIds,
          classificationChecked || {},
          classificationCredits || {}
        );
        if (status.listProgressDetails && status.listProgressDetails.length > 0) {
          selectiveListDetails = status.listProgressDetails;
        }
      }

      // Combined selective rule
      const combinedSelectiveRule = templateRules.find(r => r.type === 'minCreditsFromSelectedLists' || r.description?.includes('דרישות מרוכבות'));
      let combinedSelectiveStatus: { description: string; currentProgress: string; isSatisfied: boolean; currentValueDone?: number; currentValuePlanned?: number; requiredValue?: number } | null = null;
      if (combinedSelectiveRule) {
        const status = evaluateRule(
          combinedSelectiveRule,
          coursesInCurrentPlan,
          grades,
          binaryStates || {},
          degreeTemplate['courses-lists'],
          degreeTemplate.definedMandatoryCourseIds,
          classificationChecked || {},
          classificationCredits || {}
        );
        combinedSelectiveStatus = {
          description: combinedSelectiveRule.description || 'דרישות מרוכבות מרשימות בחירה',
          currentProgress: status.currentProgressString,
          isSatisfied: status.isSatisfied,
          currentValueDone: status.currentValueDone ?? undefined,
          currentValuePlanned: status.currentValuePlanned ?? undefined,
          requiredValue: status.requiredValue ?? undefined,
        };
      }

      // Classification rule items
      const classificationRule = (globalRules || []).find(r => r.type === 'classification_courses') || templateRules.find(r => r.type === 'classification_courses');
      const classificationItems = classificationRule?.courses?.map(c => ({
        id: c.id,
        name: c.name,
        checked: Boolean(classificationChecked?.[c.id]),
        credits: classificationCredits?.[c.id] ?? 0,
        hasNumberInput: Boolean(c.creditInput),
      })) || [];

      // Canvas dimensions setup
      const scale = 2; // 2x Retina resolution
      const colWidth = 270;
      const colGap = 16;
      const padding = 32;
      const headerHeight = 90;
      const cardHeight = 110;
      const cardGap = 12;
      const titleHeight = 44;

      const numCols = Math.max(1, sortedSemesters.length);
      const contentWidth = numCols * colWidth + (numCols - 1) * colGap;
      const finalContentWidth = Math.max(contentWidth, 2320); // Guarantee sufficient room for all 6 summary dashboard tables/cards
      const totalWidth = finalContentWidth + padding * 2;

      // Calculate max courses across semesters to determine canvas total height
      let maxCourses = 1;
      for (const [, cids] of sortedSemesters) {
        if (cids.length > maxCourses) maxCourses = cids.length;
      }

      const dashboardGap = 20;
      const dashboardY = padding + headerHeight + dashboardGap;
      const dashboardHeight = Math.max(340, 75 + sortedSemesters.length * 26 + 18);
      const semestersStartY = dashboardY + dashboardHeight + 24;

      const totalHeight = semestersStartY + titleHeight + maxCourses * (cardHeight + cardGap) + padding + 40;

      const canvas = document.createElement('canvas');
      canvas.width = totalWidth * scale;
      canvas.height = totalHeight * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Cannot get canvas context');

      ctx.scale(scale, scale);

      // 3. Background
      ctx.fillStyle = '#f8fafc'; // slate-50
      ctx.fillRect(0, 0, totalWidth, totalHeight);

      // 4. Header Banner
      ctx.fillStyle = '#1e293b'; // slate-800
      ctx.beginPath();
      ctx.roundRect(padding, padding, finalContentWidth, headerHeight, 12);
      ctx.fill();

      // Header Text (RTL)
      ctx.direction = 'rtl';
      ctx.textAlign = 'right';

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
      ctx.fillText(degreeTemplate.name || 'תוכנית לימודים', totalWidth - padding - 24, padding + 36);

      ctx.font = '14px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#cbd5e1'; // slate-300
      const subtitle = `סה״כ נק״ז מתוכננות: ${totalPlannedCredits.toFixed(1)} נק״ז • נקודות נדרשות לתואר: ${degreeRequiredCredits} נק״ז • שעות שבועיות כוללות: ${overallTotalHours % 1 === 0 ? overallTotalHours : overallTotalHours.toFixed(1)} ש״ש • ${sortedSemesters.length} סמסטרים`;
      ctx.fillText(subtitle, totalWidth - padding - 24, padding + 66);

      // Badges on left of header banner
      ctx.textAlign = 'left';
      ctx.direction = 'ltr';
      ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#38bdf8'; // sky-400
      if (overallAverage !== null) {
        ctx.fillText(`ממוצע משוקלל: ${overallAverage.toFixed(2)}`, padding + 24, padding + 38);
      }
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px system-ui, -apple-system, sans-serif';
      ctx.fillText(`הופק מ-DegreePlanner • ${new Date().toLocaleDateString('he-IL')}`, padding + 24, padding + 66);

      // 5. Dashboard Cards (Summary Tables from Top View)
      // RTL layout: Cards ordered from right to left as seen in app:
      // [סיכום נק"ז וממוצע], [עומס שעות שבועיות], [התקדמות אקדמית כללית], [קורסים מרשימות בחירה], [דרישות מרוכבות], [פטורים]
      interface DashboardCardItem {
        id: string;
        render: (x: number, y: number, w: number, h: number) => void;
      }

      const dashboardCards: DashboardCardItem[] = [];

      // Card 1 (Far Right in RTL): Averages & Credits Table
      dashboardCards.push({
        id: 'averages',
        render: (x, y, w, h) => {
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.roundRect(x, y, w, h, 10);
          ctx.fill();
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.direction = 'rtl';
          ctx.textAlign = 'right';
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
          ctx.fillText('📊 סיכום נק"ז וממוצע', x + w - 14, y + 26);

          const subY = y + 36;
          const subH = 30;
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.roundRect(x + 10, subY, w - 20, subH, 6);
          ctx.fill();

          ctx.font = '11px system-ui, -apple-system, sans-serif';
          ctx.fillStyle = '#94a3b8';
          ctx.fillText('ממוצע כללי:', x + w - 18, subY + 19);
          ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
          ctx.fillStyle = '#38bdf8';
          const avgStr = overallAverage !== null ? overallAverage.toFixed(2) : '-';
          ctx.fillText(avgStr, x + w - 82, subY + 19);

          ctx.direction = 'ltr';
          ctx.textAlign = 'left';
          ctx.font = '11px system-ui, -apple-system, sans-serif';
          ctx.fillStyle = '#94a3b8';
          ctx.fillText('סה״כ:', x + 18, subY + 19);
          ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(`${totalPlannedCredits.toFixed(1)} נק״ז`, x + 50, subY + 19);

          let rowY = subY + subH + 10;
          const rowHeight = 24;
          sortedSemesters.forEach(([semName]) => {
            const calc = semesterCalculations[semName];
            const semCr = calc?.totalCredits || 0;
            const semAvg = calc?.average !== null && calc?.average !== undefined ? calc.average.toFixed(2) : '-';

            ctx.direction = 'rtl';
            ctx.textAlign = 'right';
            ctx.font = '12px system-ui, -apple-system, sans-serif';
            ctx.fillStyle = '#e2e8f0';
            ctx.fillText(semName + ':', x + w - 16, rowY + 16);

            ctx.font = '11px system-ui, -apple-system, sans-serif';
            ctx.fillStyle = '#94a3b8';
            ctx.fillText(`(${semCr % 1 === 0 ? semCr : semCr.toFixed(1)} נק״ז)`, x + w - 95, rowY + 16);

            ctx.direction = 'ltr';
            ctx.textAlign = 'left';
            ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(semAvg, x + 16, rowY + 16);

            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(x + 10, rowY + rowHeight);
            ctx.lineTo(x + w - 10, rowY + rowHeight);
            ctx.stroke();

            rowY += rowHeight;
          });
        }
      });

      // Card 2: Weekly Hours Breakdown Table
      dashboardCards.push({
        id: 'weeklyHours',
        render: (x, y, w, h) => {
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.roundRect(x, y, w, h, 10);
          ctx.fill();
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.direction = 'rtl';
          ctx.textAlign = 'right';
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
          ctx.fillText('⏱️ עומס שעות שבועיות (ש"ש)', x + w - 14, y + 26);

          const subY = y + 36;
          const subH = 30;
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.roundRect(x + 10, subY, w - 20, subH, 6);
          ctx.fill();

          ctx.font = '11px system-ui, -apple-system, sans-serif';
          ctx.fillStyle = '#94a3b8';
          ctx.fillText('ממוצע לסמסטר:', x + w - 18, subY + 19);
          ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
          ctx.fillStyle = '#2dd4bf';
          const avgHStr = `${overallAverageHours % 1 === 0 ? overallAverageHours : overallAverageHours.toFixed(1)} ש״ש`;
          ctx.fillText(avgHStr, x + w - 100, subY + 19);

          ctx.direction = 'ltr';
          ctx.textAlign = 'left';
          ctx.font = '11px system-ui, -apple-system, sans-serif';
          ctx.fillStyle = '#94a3b8';
          ctx.fillText('סה״כ:', x + 18, subY + 19);
          ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(`${overallTotalHours % 1 === 0 ? overallTotalHours : overallTotalHours.toFixed(1)} ש״ש`, x + 50, subY + 19);

          let rowY = subY + subH + 10;
          const rowHeight = 24;
          sortedSemesters.forEach(([semName]) => {
            const calc = weeklyHoursCalculations[semName] || { totalHours: 0, lectureHours: 0, tutorialHours: 0, labHours: 0 };
            const lec = calc.lectureHours % 1 === 0 ? calc.lectureHours : calc.lectureHours.toFixed(1);
            const tut = calc.tutorialHours % 1 === 0 ? calc.tutorialHours : calc.tutorialHours.toFixed(1);
            const lab = calc.labHours % 1 === 0 ? calc.labHours : calc.labHours.toFixed(1);
            const tot = calc.totalHours % 1 === 0 ? calc.totalHours : calc.totalHours.toFixed(1);

            ctx.direction = 'rtl';
            ctx.textAlign = 'right';
            ctx.font = '12px system-ui, -apple-system, sans-serif';
            ctx.fillStyle = '#e2e8f0';
            ctx.fillText(semName + ':', x + w - 16, rowY + 16);

            ctx.font = '10px system-ui, -apple-system, sans-serif';
            ctx.fillStyle = '#94a3b8';
            const breakdown = `(${lec} הר', ${tut} תר'${calc.labHours > 0 ? `, ${lab} מעב'` : ''})`;
            ctx.fillText(breakdown, x + w - 85, rowY + 16);

            ctx.direction = 'ltr';
            ctx.textAlign = 'left';
            ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
            ctx.fillStyle = '#2dd4bf';
            ctx.fillText(`${tot} ש״ש`, x + 16, rowY + 16);

            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(x + 10, rowY + rowHeight);
            ctx.lineTo(x + w - 10, rowY + rowHeight);
            ctx.stroke();

            rowY += rowHeight;
          });
        }
      });

      // Card 3: Consolidated Academic Progress
      if (consolidatedEvaluated.length > 0) {
        dashboardCards.push({
          id: 'consolidated',
          render: (x, y, w, h) => {
            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, 10);
            ctx.fill();
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.direction = 'rtl';
            ctx.textAlign = 'right';
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
            ctx.fillText('📈 התקדמות אקדמית כללית', x + w - 14, y + 26);

            // Legend
            const legY = y + 36;
            ctx.fillStyle = '#22c55e';
            ctx.fillRect(x + w - 20, legY, 9, 9);
            ctx.font = '10px system-ui, -apple-system, sans-serif';
            ctx.fillStyle = '#cbd5e1';
            ctx.fillText('נלקח', x + w - 33, legY + 8);

            ctx.fillStyle = '#eab308';
            ctx.fillRect(x + w - 75, legY, 9, 9);
            ctx.fillStyle = '#cbd5e1';
            ctx.fillText('בתכנון', x + w - 88, legY + 8);

            ctx.fillStyle = '#64748b';
            ctx.fillRect(x + w - 135, legY, 9, 9);
            ctx.fillStyle = '#cbd5e1';
            ctx.fillText('חסר', x + w - 148, legY + 8);

            let itemY = y + 58;
            const barW = w - 28;
            const barH = 6;

            consolidatedEvaluated.forEach(item => {
              ctx.direction = 'rtl';
              ctx.textAlign = 'right';
              ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
              ctx.fillStyle = item.isSatisfied ? '#86efac' : '#fde047';
              ctx.fillText(item.description, x + w - 14, itemY + 14);

              ctx.direction = 'ltr';
              ctx.textAlign = 'left';
              ctx.font = '10px system-ui, -apple-system, sans-serif';
              ctx.fillStyle = '#94a3b8';
              ctx.fillText(item.currentProgress, x + 14, itemY + 14);

              const doneVal = item.currentValueDone ?? 0;
              const planVal = item.currentValuePlanned ?? 0;
              const reqVal = item.requiredValue && item.requiredValue > 0 ? item.requiredValue : 1;
              const pctDone = Math.min(100, Math.max(0, (doneVal / reqVal) * 100));
              const pctPlan = Math.min(100 - pctDone, Math.max(0, ((planVal - doneVal) / reqVal) * 100));

              drawProgressBar(ctx, x + 14, itemY + 22, barW, barH, pctDone, pctPlan);

              itemY += 46;
            });
          }
        });
      }

      // Card 4: Elective Lists
      if (selectiveListDetails.length > 0) {
        dashboardCards.push({
          id: 'selectiveLists',
          render: (x, y, w, h) => {
            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, 10);
            ctx.fill();
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.direction = 'rtl';
            ctx.textAlign = 'right';
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
            ctx.fillText('📋 קורסים מרשימות בחירה', x + w - 14, y + 26);

            let itemY = y + 42;
            const barW = Math.min(110, w * 0.32);
            const barH = 6;

            selectiveListDetails.forEach(detail => {
              ctx.direction = 'rtl';
              ctx.textAlign = 'right';
              ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
              ctx.fillStyle = detail.isSatisfied ? '#86efac' : '#fde047';
              ctx.fillText(detail.listName, x + w - 14, itemY + 13);

              ctx.font = '10px system-ui, -apple-system, sans-serif';
              ctx.fillStyle = '#94a3b8';
              const progressTxt = `${detail.currentValueDone}/${detail.requiredValue} ${detail.unit || 'קורסים'} (מתוכנן: ${detail.currentValuePlanned})`;
              ctx.fillText(progressTxt, x + w - 14, itemY + 27);

              const req = detail.requiredValue > 0 ? detail.requiredValue : 1;
              const pctDone = Math.min(100, Math.max(0, (detail.currentValueDone / req) * 100));
              const pctPlan = Math.min(100 - pctDone, Math.max(0, ((detail.currentValuePlanned - detail.currentValueDone) / req) * 100));
              drawProgressBar(ctx, x + 14, itemY + 16, barW, barH, pctDone, pctPlan);

              ctx.strokeStyle = '#334155';
              ctx.lineWidth = 0.8;
              ctx.beginPath();
              ctx.moveTo(x + 10, itemY + 34);
              ctx.lineTo(x + w - 10, itemY + 34);
              ctx.stroke();

              itemY += 38;
            });
          }
        });
      }

      // Card 5: Combined Selective Requirements
      if (combinedSelectiveStatus) {
        dashboardCards.push({
          id: 'combinedSelective',
          render: (x, y, w, h) => {
            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, 10);
            ctx.fill();
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.direction = 'rtl';
            ctx.textAlign = 'right';
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
            ctx.fillText('⚖️ דרישות מרוכבות', x + w - 14, y + 26);

            const itemY = y + 46;
            const barW = w - 28;
            const barH = 7;

            ctx.direction = 'rtl';
            ctx.textAlign = 'right';
            ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
            ctx.fillStyle = combinedSelectiveStatus!.isSatisfied ? '#86efac' : '#fdba74';
            ctx.fillText(combinedSelectiveStatus!.description, x + w - 14, itemY + 14);

            ctx.direction = 'ltr';
            ctx.textAlign = 'left';
            ctx.font = '10px system-ui, -apple-system, sans-serif';
            ctx.fillStyle = '#94a3b8';
            ctx.fillText(combinedSelectiveStatus!.currentProgress, x + 14, itemY + 14);

            const doneVal = combinedSelectiveStatus!.currentValueDone ?? 0;
            const planVal = combinedSelectiveStatus!.currentValuePlanned ?? 0;
            const reqVal = combinedSelectiveStatus!.requiredValue && combinedSelectiveStatus!.requiredValue > 0 ? combinedSelectiveStatus!.requiredValue : 1;
            const pctDone = Math.min(100, Math.max(0, (doneVal / reqVal) * 100));
            const pctPlan = Math.min(100 - pctDone, Math.max(0, ((planVal - doneVal) / reqVal) * 100));

            drawProgressBar(ctx, x + 14, itemY + 24, barW, barH, pctDone, pctPlan);
          }
        });
      }

      // Card 6 (Far Left in RTL): Exemptions & Classifications
      if (classificationItems.length > 0) {
        dashboardCards.push({
          id: 'exemptions',
          render: (x, y, w, h) => {
            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, 10);
            ctx.fill();
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.direction = 'rtl';
            ctx.textAlign = 'right';
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
            ctx.fillText('🛡️ פטורים וסיווגים', x + w - 14, y + 26);

            let itemY = y + 44;
            const rowHeight = 32;

            classificationItems.forEach(item => {
              ctx.direction = 'rtl';
              ctx.textAlign = 'right';
              ctx.font = '12px system-ui, -apple-system, sans-serif';
              ctx.fillStyle = '#e2e8f0';
              ctx.fillText(item.name, x + w - 16, itemY + 16);

              ctx.direction = 'ltr';
              ctx.textAlign = 'left';
              ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';

              if (item.hasNumberInput) {
                const pts = item.credits ?? 0;
                ctx.fillStyle = pts > 0 ? '#86efac' : '#94a3b8';
                ctx.fillText(`${pts} נק״ז`, x + 16, itemY + 16);
              } else {
                const isChecked = Boolean(item.checked);
                ctx.fillStyle = isChecked ? '#4ade80' : '#f87171';
                ctx.fillText(isChecked ? '✓ פטור' : '✗ חסר', x + 16, itemY + 16);
              }

              ctx.strokeStyle = '#334155';
              ctx.lineWidth = 0.8;
              ctx.beginPath();
              ctx.moveTo(x + 10, itemY + rowHeight);
              ctx.lineTo(x + w - 10, itemY + rowHeight);
              ctx.stroke();

              itemY += rowHeight;
            });
          }
        });
      }

      // Draw all dashboard cards evenly spaced across the canvas width
      const numDashboardCards = dashboardCards.length;
      const dashboardCardGap = 16;
      const dashboardCardWidth = Math.floor((finalContentWidth - (numDashboardCards - 1) * dashboardCardGap) / numDashboardCards);

      dashboardCards.forEach((card, index) => {
        // RTL placement: index 0 (Averages) is placed at the far right
        const cardX = totalWidth - padding - (index + 1) * dashboardCardWidth - index * dashboardCardGap;
        card.render(cardX, dashboardY, dashboardCardWidth, dashboardHeight);
      });

      // 6. Draw Semesters from Right to Left
      sortedSemesters.forEach(([semName, cids], colIndex) => {
        const xPos = totalWidth - padding - (colIndex + 1) * colWidth - colIndex * colGap;

        // Semester Header
        const semCredits = semesterCalculations[semName]?.totalCredits || 0;
        ctx.direction = 'rtl';
        ctx.textAlign = 'right';
        ctx.fillStyle = semName === SEMESTER_0_NAME ? '#059669' : '#2563eb'; // emerald-600 or blue-600
        ctx.beginPath();
        ctx.roundRect(xPos, semestersStartY, colWidth, titleHeight - 6, 8);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
        ctx.fillText(semName, xPos + colWidth - 12, semestersStartY + 24);

        ctx.textAlign = 'left';
        ctx.direction = 'ltr';
        ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = '#e2e8f0';
        ctx.fillText(`${semCredits % 1 === 0 ? semCredits : semCredits.toFixed(1)} נק״ז`, xPos + 12, semestersStartY + 24);

        // Course cards in this semester
        let cardY = semestersStartY + titleHeight;
        cids.forEach(cid => {
          const course = effectiveAllCourses.find(c => c._id === cid || c._id === cid.replace(/^0+/, '') || ('0' + c._id) === cid);
          const grade = grades[cid];
          const isBonus = cid === 'bonus_credits';

          // Card background
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.roundRect(xPos, cardY, colWidth, cardHeight, 8);
          ctx.fill();

          ctx.strokeStyle = isBonus ? '#10b981' : '#e2e8f0';
          ctx.lineWidth = isBonus ? 2 : 1.5;
          ctx.stroke();

          // Card content
          ctx.direction = 'rtl';
          ctx.textAlign = 'right';

          // Course title
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
          const courseTitle = isBonus ? '🎁 בונוסים (סמסטר 0)' : (course?.name || `קורס ${cid}`);
          const displayTitle = truncateText(ctx, courseTitle, colWidth - 24);
          ctx.fillText(displayTitle, xPos + colWidth - 12, cardY + 24);

          // Course ID / subtitle
          ctx.fillStyle = '#64748b';
          ctx.font = '11px system-ui, -apple-system, sans-serif';
          ctx.fillText(isBonus ? 'נקודות חופשיות לתואר' : `מס׳: ${cid}`, xPos + colWidth - 12, cardY + 44);

          // Credits
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
          const courseCredits = isBonus
            ? bonusPts
            : (classificationCredits && classificationCredits[cid] !== undefined
                ? classificationCredits[cid]
                : (course?.credits ?? '-'));
          const crText = `נק״ז: ${courseCredits}`;
          ctx.fillText(crText, xPos + colWidth - 12, cardY + 68);

          // Grade badge / Input display
          if (grade) {
            ctx.fillStyle = '#dbeafe'; // blue-100
            ctx.beginPath();
            ctx.roundRect(xPos + 10, cardY + 12, 48, 22, 4);
            ctx.fill();

            ctx.direction = 'ltr';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#1d4ed8'; // blue-700
            ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
            ctx.fillText(grade, xPos + 34, cardY + 28);
          }

          cardY += cardHeight + cardGap;
        });
      });

      // 7. Download High-Res PNG
      const link = document.createElement('a');
      link.download = `degree_plan_${degreeTemplate.id || 'export'}_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      setExportStatus('הורדת התמונה החלה בהצלחה!');
      setTimeout(() => {
        setIsExportingImage(false);
        setExportStatus(null);
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Failed to export image:', err);
      setExportStatus('שגיאה בייצוא התמונה');
      setIsExportingImage(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="ייצוא מפת הלימודים (תמונה ברזולוציה גבוהה)"
      maxWidth="max-w-md"
    >
      <div className="space-y-4 text-right" dir="rtl">
        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
          באפשרותך לייצא תמונה חדה ושלמה (PNG באיכות Retina 2x) הכוללת את כל לוחות הסיכום (שעות שבועיות, נק״ז וממוצעים, התקדמות אקדמית, פטורים) ואת כל הסמסטרים, הקורסים והציונים:
        </p>

        <div className="grid grid-cols-1 gap-3 pt-2">
          {/* High-Res PNG Image Option */}
          <button
            type="button"
            onClick={handleExportHighResImage}
            disabled={isExportingImage}
            className="flex items-start gap-3 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/60 transition-all text-right shadow-sm group disabled:opacity-60"
          >
            <span className="text-2xl mt-0.5">🖼️</span>
            <div className="flex-1">
              <div className="font-bold text-sm text-emerald-900 dark:text-emerald-100 group-hover:underline">
                הורד כתמונה ברזולוציה גבוהה (PNG)
              </div>
              <div className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                מייצר תמונה מלאה ואיכותית של כל המפה, לוחות הסיכום העליונים, הסמסטרים והציונים.
              </div>
            </div>
          </button>
        </div>

        {exportStatus && (
          <div className="p-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-center text-xs font-semibold text-gray-800 dark:text-gray-200 animate-pulse">
            {exportStatus}
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 transition-colors"
          >
            סגור
          </button>
        </div>
      </div>
    </BaseModal>
  );
};

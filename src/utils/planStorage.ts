import { DegreeTemplate } from "../types/data";

const AUTOSAVE_STORAGE_KEY = 'degreePlannerAutosavedPlan_2027_v1';

export interface StoredPlan {
  template: DegreeTemplate;
  grades: Record<string, string>;
  classificationChecked: Record<string, boolean>;
  classificationCredits: Record<string, number>;
  binaryStates?: Record<string, boolean>;
  lockedSemesters?: Record<string, boolean>;
  timestamp?: number;
  lastSaved?: string; 
}

interface StorageStructure {
  autosavedPlan?: StoredPlan;
}

function getStorageData(): StorageStructure {
  try {
    const rawData = localStorage.getItem(AUTOSAVE_STORAGE_KEY);
    if (rawData) {
      const parsed = JSON.parse(rawData) as StorageStructure;
      if (parsed && (parsed.autosavedPlan === undefined || (parsed.autosavedPlan && parsed.autosavedPlan.template))) {
        return parsed;
      }
    }
  } catch (error) {
    console.error("Error reading plan data from localStorage:", error);
  }
  return { autosavedPlan: undefined };
}

function setStorageData(data: StorageStructure): void {
  try {
    localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Error saving plan data to localStorage:", error);
  }
}

export function savePlan(
  template: DegreeTemplate,
  grades: Record<string, string>,
  classificationChecked: Record<string, boolean>,
  classificationCredits: Record<string, number>,
  binaryStates: Record<string, boolean>,
  lockedSemesters?: Record<string, boolean>
): void {
  // Refuse to overwrite local storage if regular semesters have 0 courses
  const countRegularCourses = (semMap?: Record<string, string[]>): number => {
    if (!semMap || typeof semMap !== 'object') return 0;
    return Object.entries(semMap).reduce((acc, [sName, ids]) => {
      if (sName === 'סמסטר 0' || sName.includes('סמסטר 0')) return acc;
      return acc + (Array.isArray(ids) ? ids.filter(id => id && id !== 'bonus_credits').length : 0);
    }, 0);
  };

  if (template && countRegularCourses(template.semesters) === 0) {
    console.warn('[savePlan] Aborted save: template regular semesters contain 0 courses. Refusing to overwrite local storage with empty plan.');
    return;
  }

  const planToSave: StoredPlan = {
    template: template,
    grades: grades,
    classificationChecked: classificationChecked,
    classificationCredits: classificationCredits,
    binaryStates: binaryStates,
    lockedSemesters: lockedSemesters,
    timestamp: Date.now(),
    lastSaved: new Date().toISOString(),
  };
  
  setStorageData({ autosavedPlan: planToSave });
}

export function loadPlan(): StoredPlan | null {
  const storage = getStorageData();
  if (storage.autosavedPlan) {
    return storage.autosavedPlan;
  }
  return null;
}
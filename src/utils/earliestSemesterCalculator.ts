import { RawCourseData, PrerequisiteItem, PrerequisiteGroup } from '../types/data';
import { getSemesterOrderIndex, numberToHebrewLetter } from './hebrewUtils';
import { getEquivalentCourses } from './prerequisiteChecker';

export interface EarliestSemesterResult {
  semesterNumber: number; // 1 = סמסטר א', 2 = סמסטר ב', etc. (or 0 if placed in semester 0)
  semesterLetter: string; // "א'", "ב'", "ג'", etc. (empty string if course is in semester 0)
  seasonConstraint?: 'winter_only' | 'spring_only';
}

/**
 * Calculates the earliest semester in which a target course CAN BE TAKEN,
 * based strictly on the placements of its prerequisites (direct and indirect)
 * in the user's plan, taking into account Semester 0 prior studies, exemptions,
 * and equivalent courses.
 *
 * CRITICAL RULE:
 * The target course's OWN placement in a regular semester must NEVER determine
 * its earliest semester! It must inspect its PREREQUISITES!
 */
export function calculateEarliestSemester(
  targetCourseId: string,
  allCourses: RawCourseData[],
  semesters?: Record<string, string[]>,
  classificationChecked?: Record<string, boolean>,
  lockedSemesters?: Record<string, boolean>
): EarliestSemesterResult {
  const courseMap = new Map<string, RawCourseData>();
  for (const c of allCourses) {
    courseMap.set(c._id, c);
  }

  // Set of semester order indices that are locked/finalized
  const lockedSemesterIndices = new Set<number>();
  if (lockedSemesters && semesters) {
    for (const semKey of Object.keys(semesters)) {
      if (lockedSemesters[semKey]) {
        lockedSemesterIndices.add(getSemesterOrderIndex(semKey));
      }
    }
  }

  // Map each course placed in the plan (AND its equivalents) to its earliest semester order index:
  // Semester 0 -> 0
  // Semester א' -> 1
  // Semester ב' -> 2, etc.
  const coursePlanSemesterMap = new Map<string, number>();
  if (semesters) {
    for (const [semKey, courseIds] of Object.entries(semesters)) {
      const semIdx = getSemesterOrderIndex(semKey);
      for (const cid of courseIds) {
        // Direct course
        const existing = coursePlanSemesterMap.get(cid);
        if (existing === undefined || semIdx < existing) {
          coursePlanSemesterMap.set(cid, semIdx);
        }
        // Also map equivalent courses so prerequisites satisfied by equivalents are found!
        const eqSet = getEquivalentCourses(cid, allCourses);
        for (const eqId of eqSet) {
          const existingEq = coursePlanSemesterMap.get(eqId);
          if (existingEq === undefined || semIdx < existingEq) {
            coursePlanSemesterMap.set(eqId, semIdx);
          }
        }
      }
    }
  }

  // If the target course is placed in Semester 0, it was taken beforehand
  if (coursePlanSemesterMap.get(targetCourseId) === 0) {
    return {
      semesterNumber: 0,
      semesterLetter: '',
    };
  }

  // If the target course is placed in a locked/finalized semester, its semester is locked in place!
  const targetPlacedSem = coursePlanSemesterMap.get(targetCourseId);
  if (targetPlacedSem !== undefined && lockedSemesterIndices.has(targetPlacedSem)) {
    return {
      semesterNumber: targetPlacedSem,
      semesterLetter: numberToHebrewLetter(targetPlacedSem),
    };
  }

  // Cache for theoretical earliest semester of prerequisites to prevent cycles
  const memo = new Map<string, number>();
  const visiting = new Set<string>();

  const getPrereqEarliest = (cid: string, isTarget: boolean = false): number => {
    // For prerequisite courses (not target), check plan placement first:
    if (!isTarget) {
      // Completed beforehand in Semester 0 -> semester index 0
      if (coursePlanSemesterMap.get(cid) === 0) {
        return 0;
      }

      // Classification exemptions (e.g. סיווג פיזיקה) -> semester index 0
      const classificationIds = ['01130013', '01130014', 'miluim_exemption'];
      if (classificationIds.includes(cid) && classificationChecked?.[cid]) {
        return 0;
      }

      // If placed in a regular semester in the plan:
      // If that semester is locked, or placed normally, that prerequisite is completed at placedSem!
      const placedSem = coursePlanSemesterMap.get(cid);
      if (placedSem !== undefined && placedSem > 0) {
        return placedSem;
      }

      if (memo.has(cid)) return memo.get(cid)!;
    }

    if (visiting.has(cid)) return 1; // Safeguard against circular dependencies
    visiting.add(cid);

    const courseData = courseMap.get(cid);
    if (!courseData || !courseData.prereqTree) {
      visiting.delete(cid);
      if (!isTarget) memo.set(cid, 1);
      return 1; // Course has no prerequisites; can be taken in Semester 1
    }

    // Evaluate prereqTree recursively
    const evalTree = (node: PrerequisiteItem | PrerequisiteGroup | any): number => {
      if (!node) return 0;
      if (typeof node === 'string') {
        const prereqCompletedSem = getPrereqEarliest(node, false);
        // The dependent course can be taken in the semester AFTER the prerequisite:
        // If prerequisite completed in Semester 0: 0 + 1 = 1 (can be taken in Semester 1!)
        // If prerequisite completed in Semester 1: 1 + 1 = 2 (can be taken in Semester 2!)
        // If prerequisite completed in Semester 2: 2 + 1 = 3 (can be taken in Semester 3!)
        return prereqCompletedSem + 1;
      }
      if (node.and && Array.isArray(node.and)) {
        if (node.and.length === 0) return 1;
        let maxVal = 1;
        for (const child of node.and) {
          maxVal = Math.max(maxVal, evalTree(child));
        }
        return maxVal;
      }
      if (node.or && Array.isArray(node.or)) {
        if (node.or.length === 0) return 1;
        let minVal = 999;
        for (const child of node.or) {
          minVal = Math.min(minVal, evalTree(child));
        }
        return minVal === 999 ? 1 : minVal;
      }
      if (node.list && Array.isArray(node.list)) {
        if (node.list.length === 0) return 1;
        if (node.type === 'one') {
          let minVal = 999;
          for (const child of node.list) {
            minVal = Math.min(minVal, evalTree(child));
          }
          return minVal === 999 ? 1 : minVal;
        } else {
          let maxVal = 1;
          for (const child of node.list) {
            maxVal = Math.max(maxVal, evalTree(child));
          }
          return maxVal;
        }
      }
      return 1;
    };

    let baseEarliest = evalTree(courseData.prereqTree);
    if (baseEarliest < 1) baseEarliest = 1;

    visiting.delete(cid);
    if (!isTarget) memo.set(cid, baseEarliest);
    return baseEarliest;
  };

  let finalEarliest = getPrereqEarliest(targetCourseId, true);

  // If the target course is NOT completed in Semester 0 or already locked,
  // it cannot be chosen in a semester that is already locked/finalized!
  // It must start at the earliest available unlocked regular semester >= finalEarliest.
  if (lockedSemesterIndices.size > 0) {
    while (lockedSemesterIndices.has(finalEarliest)) {
      finalEarliest += 1;
    }
  }

  const letter = numberToHebrewLetter(finalEarliest);

  return {
    semesterNumber: finalEarliest,
    semesterLetter: letter,
  };
}


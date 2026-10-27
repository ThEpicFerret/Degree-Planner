import { RawCourseData, PrerequisiteItem, PrerequisiteGroup } from '../types/data';
import { getSemesterOrderIndex, numberToHebrewLetter, SEMESTER_0_NAME } from './hebrewUtils';

export interface EarliestSemesterResult {
  semesterNumber: number; // 1 = סמסטר א', 2 = סמסטר ב', etc. (or 0 if placed in semester 0)
  semesterLetter: string; // "א'", "ב'", "ג'", etc.
  seasonConstraint?: 'winter_only' | 'spring_only';
}

/**
 * Calculates the earliest semester in which a course can be taken,
 * taking into account:
 * - Its prerequisites and their semester placement in the plan
 * - Whether prerequisites were taken in Semester 0 (עבר אקדמי/מעבר/פטורים -> semester 0)
 * - Exemption checkboxes (classification rules)
 * - Offering seasonality (Winter only -> odd semesters, Spring only -> even semesters)
 */
export function calculateEarliestSemester(
  targetCourseId: string,
  allCourses: RawCourseData[],
  semesters?: Record<string, string[]>,
  classificationChecked?: Record<string, boolean>
): EarliestSemesterResult {
  const courseMap = new Map<string, RawCourseData>();
  for (const c of allCourses) {
    courseMap.set(c._id, c);
  }

  // Map each course in the plan to its semester order index
  // Semester 0 -> 0
  // Semester א' -> 1
  // Semester ב' -> 2, etc.
  const coursePlanSemesterMap = new Map<string, number>();
  if (semesters) {
    for (const [semKey, courseIds] of Object.entries(semesters)) {
      const semIdx = getSemesterOrderIndex(semKey);
      for (const cid of courseIds) {
        // If a course is placed multiple times, take the earliest placement
        const existing = coursePlanSemesterMap.get(cid);
        if (existing === undefined || semIdx < existing) {
          coursePlanSemesterMap.set(cid, semIdx);
        }
      }
    }
  }

  // If the target course is placed in Semester 0, it was taken beforehand
  if (coursePlanSemesterMap.get(targetCourseId) === 0) {
    return {
      semesterNumber: 0,
      semesterLetter: '0',
    };
  }

  // Cache for theoretical earliest semester of courses to prevent cycles
  const memo = new Map<string, number>();
  const visiting = new Set<string>();

  const getCourseEarliest = (cid: string): number => {
    // If placed in Semester 0 or has exemption, semester is 0
    if (coursePlanSemesterMap.get(cid) === 0) {
      return 0;
    }

    // Classification exemptions
    const classificationIds = ['01130013', '01130014', 'miluim_exemption'];
    if (classificationIds.includes(cid) && classificationChecked?.[cid]) {
      return 0;
    }

    // If placed in a regular semester in the plan, use that placement
    const placedSem = coursePlanSemesterMap.get(cid);
    if (placedSem !== undefined && placedSem > 0) {
      return placedSem;
    }

    if (memo.has(cid)) return memo.get(cid)!;
    if (visiting.has(cid)) return 1; // Cycle safeguard

    visiting.add(cid);

    const courseData = courseMap.get(cid);
    if (!courseData || !courseData.prereqTree) {
      visiting.delete(cid);
      memo.set(cid, 1);
      return 1;
    }

    // Evaluate prereqTree
    const evalTree = (node: PrerequisiteItem | PrerequisiteGroup | any): number => {
      if (!node) return 0;
      if (typeof node === 'string') {
        const earliestP = getCourseEarliest(node);
        // Dependent course must be taken in a semester AFTER the prerequisite
        // If earliestP is 0 (Semester 0), then 0 + 1 = 1 (can be taken in Semester 1!)
        return earliestP + 1;
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
      return 1;
    };

    let baseEarliest = evalTree(courseData.prereqTree);
    if (baseEarliest < 1) baseEarliest = 1;

    // Apply offering seasonality
    const seasons = courseData.semesters || courseData.semester;
    let seasonConstraint: 'winter_only' | 'spring_only' | undefined;
    if (Array.isArray(seasons) && seasons.length > 0) {
      const hasWinter = seasons.some(s => s.includes('חורף') || s.toLowerCase().includes('winter') || s.includes('200'));
      const hasSpring = seasons.some(s => s.includes('אביב') || s.toLowerCase().includes('spring') || s.includes('201'));

      if (hasWinter && !hasSpring) {
        seasonConstraint = 'winter_only';
        // Winter semesters are odd (1, 3, 5, 7...)
        if (baseEarliest % 2 === 0) {
          baseEarliest += 1;
        }
      } else if (hasSpring && !hasWinter) {
        seasonConstraint = 'spring_only';
        // Spring semesters are even (2, 4, 6, 8...)
        if (baseEarliest % 2 !== 0) {
          baseEarliest += 1;
        }
      }
    }

    visiting.delete(cid);
    memo.set(cid, baseEarliest);
    return baseEarliest;
  };

  const finalEarliest = getCourseEarliest(targetCourseId);
  const letter = numberToHebrewLetter(finalEarliest);

  // Check target course season constraint
  const targetCourse = courseMap.get(targetCourseId);
  const seasons = targetCourse?.semesters || targetCourse?.semester;
  let seasonConstraint: 'winter_only' | 'spring_only' | undefined;
  if (Array.isArray(seasons) && seasons.length > 0) {
    const hasWinter = seasons.some(s => s.includes('חורף') || s.toLowerCase().includes('winter') || s.includes('200'));
    const hasSpring = seasons.some(s => s.includes('אביב') || s.toLowerCase().includes('spring') || s.includes('201'));
    if (hasWinter && !hasSpring) seasonConstraint = 'winter_only';
    else if (hasSpring && !hasWinter) seasonConstraint = 'spring_only';
  }

  return {
    semesterNumber: finalEarliest,
    semesterLetter: letter,
    seasonConstraint,
  };
}

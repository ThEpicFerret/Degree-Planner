import { DegreeTemplate, RawCourseData } from '../types/data';

export interface CourseHoursBreakdown {
  total: number;
  lecture: number;
  tutorial: number;
  lab: number;
  other: number;
  raw: string;
}

export function parseCourseHours(
  hoursStr?: string,
  courseId?: string,
  courseName?: string
): CourseHoursBreakdown {
  // Sports courses check: in Technion SAP data, sports course groups are listed together,
  // causing raw numbers to sum up to 28-32+ hours.
  // Rule: Non-team/non-advanced sports courses are 1.5 weekly hours (1.5 ש"ש); varsity teams (נבחרת) are 3 weekly hours (3 ש"ש).
  const isSportsCourse = Boolean(
    (courseId && (courseId.startsWith('039408') || courseId.startsWith('039409') || (courseId.startsWith('0394') && !['03940580', '03940582', '03940587', '03940591'].includes(courseId)))) ||
    (courseName && (courseName.includes('חינוך גופני') || courseName.includes('נבחרת ספורט') || courseName.includes('נבחרות ספורט') || courseName.startsWith('ספורט')))
  );

  if (isSportsCourse) {
    const isTeam = Boolean(courseName && (courseName.includes('נבחרת') || courseName.includes('נבחרות')));
    const sportsHours = isTeam ? 3 : 1.5;
    return {
      total: sportsHours,
      lecture: 0,
      tutorial: sportsHours,
      lab: 0,
      other: 0,
      raw: `${sportsHours} ש"ש (${isTeam ? 'נבחרת' : 'ספורט'})`,
    };
  }

  if (!hoursStr || typeof hoursStr !== 'string') {
    return { total: 0, lecture: 0, tutorial: 0, lab: 0, other: 0, raw: '' };
  }

  let lecture = 0;
  let tutorial = 0;
  let lab = 0;
  let other = 0;

  // Handles Hebrew formats: "3 הרצאה, 2 תרגול, 1 מעבדה" or "2 הרצאה"
  // Also handles formats like "3h+2t+1l"
  const parts = hoursStr.split(/[,;+]/);
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/([\d.]+)/);
    if (!match) continue;
    const val = parseFloat(match[1]);
    if (isNaN(val)) continue;

    if (trimmed.includes('הרצאה') || trimmed.toLowerCase().includes('h')) {
      lecture += val;
    } else if (trimmed.includes('תרגול') || trimmed.toLowerCase().includes('t')) {
      tutorial += val;
    } else if (trimmed.includes('מעבדה') || trimmed.includes('סדנה') || trimmed.includes('פרויקט') || trimmed.toLowerCase().includes('l')) {
      lab += val;
    } else {
      other += val;
    }
  }

  const total = lecture + tutorial + lab + other;
  return { total, lecture, tutorial, lab, other, raw: hoursStr };
}

export interface SemesterHoursCalculation {
  totalHours: number;
  lectureHours: number;
  tutorialHours: number;
  labHours: number;
  courseCount: number;
}

export interface DegreeHoursCalculation {
  overallTotalHours: number;
  overallAverageHours: number;
  semesterCalculations: Record<string, SemesterHoursCalculation>;
}

export function calculateAllWeeklyHours(
  template?: DegreeTemplate,
  allCourses?: RawCourseData[]
): DegreeHoursCalculation {
  if (!template || !template.semesters || !Array.isArray(allCourses)) {
    return {
      overallTotalHours: 0,
      overallAverageHours: 0,
      semesterCalculations: {},
    };
  }

  const courseMap = new Map<string, RawCourseData>();
  for (const c of allCourses) {
    courseMap.set(c._id, c);
  }

  const semesterCalculations: Record<string, SemesterHoursCalculation> = {};
  let overallTotalHours = 0;
  let regularSemesterCount = 0;

  for (const [semKey, courseIds] of Object.entries(template.semesters)) {
    let semTotal = 0;
    let semLecture = 0;
    let semTutorial = 0;
    let semLab = 0;
    let count = 0;

    for (const cid of courseIds) {
      const course = courseMap.get(cid);
      if (course) {
        const breakdown = parseCourseHours(course.hours, course._id, course.name);
        semTotal += breakdown.total;
        semLecture += breakdown.lecture;
        semTutorial += breakdown.tutorial;
        semLab += breakdown.lab + breakdown.other;
        count++;
      }
    }

    semesterCalculations[semKey] = {
      totalHours: semTotal,
      lectureHours: semLecture,
      tutorialHours: semTutorial,
      labHours: semLab,
      courseCount: count,
    };

    overallTotalHours += semTotal;
    if (semKey !== 'סמסטר 0' && count > 0) {
      regularSemesterCount++;
    }
  }

  const overallAverageHours = regularSemesterCount > 0
    ? overallTotalHours / regularSemesterCount
    : 0;

  return {
    overallTotalHours,
    overallAverageHours,
    semesterCalculations,
  };
}

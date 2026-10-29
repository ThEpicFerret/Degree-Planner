// Helper for displaying when a course is offered (winter / spring / summer / all year / unknown)

export interface SemesterOfferingInfo {
  emoji: string;
  label: string;
  tooltip: string;
  isUnknown: boolean;
}

const normalizeSemesterName = (s: string): 'winter' | 'spring' | 'summer' | null => {
  const t = (s || '').trim();
  if (t.includes('חורף') || /winter/i.test(t)) return 'winter';
  if (t.includes('אביב') || /spring/i.test(t)) return 'spring';
  if (t.includes('קיץ') || /summer/i.test(t)) return 'summer';
  return null;
};

export const getSemesterOfferingInfo = (semesters?: unknown): SemesterOfferingInfo => {
  const list = Array.isArray(semesters) ? semesters.filter((x): x is string => typeof x === 'string') : [];
  const set = new Set(list.map(normalizeSemesterName).filter(Boolean) as Array<'winter' | 'spring' | 'summer'>);

  const w = set.has('winter');
  const s = set.has('spring');
  const su = set.has('summer');

  if (!w && !s && !su) {
    return {
      emoji: '❓',
      label: 'סמסטר לא ידוע',
      tooltip: 'אין לנו מידע באיזה סמסטר הקורס ניתן — בדקו באתר הקורסים / SAP',
      isUnknown: true,
    };
  }
  if (w && s && su) {
    return { emoji: '❄️🌸☀️', label: 'כל השנה (חורף, אביב וקיץ)', tooltip: 'הקורס ניתן בחורף, באביב ובקיץ', isUnknown: false };
  }
  if (w && s) {
    return { emoji: '❄️🌸', label: 'חורף ואביב', tooltip: 'הקורס ניתן בסמסטר חורף ובסמסטר אביב', isUnknown: false };
  }
  if (w && su) {
    return { emoji: '❄️☀️', label: 'חורף וקיץ', tooltip: 'הקורס ניתן בסמסטר חורף ובסמסטר קיץ (לא באביב)', isUnknown: false };
  }
  if (s && su) {
    return { emoji: '🌸☀️', label: 'אביב וקיץ', tooltip: 'הקורס ניתן בסמסטר אביב ובסמסטר קיץ (לא בחורף)', isUnknown: false };
  }
  if (w) return { emoji: '❄️', label: 'חורף בלבד', tooltip: 'הקורס ניתן רק בסמסטר חורף', isUnknown: false };
  if (s) return { emoji: '🌸', label: 'אביב בלבד', tooltip: 'הקורס ניתן רק בסמסטר אביב', isUnknown: false };
  return { emoji: '☀️', label: 'קיץ בלבד', tooltip: 'הקורס ניתן רק בסמסטר קיץ', isUnknown: false };
};

/**
 * Checks if a course placed in a specific semester has an offering season mismatch.
 * In the Technion academic year:
 * - Odd semesters (1, 3, 5, 7, 9...) are Winter semesters (סמסטר חורף).
 * - Even semesters (2, 4, 6, 8, 10...) are Spring semesters (סמסטר אביב).
 * - Semester 0 is exemptions/prior studies, where seasonality does not apply.
 */
export function checkSeasonMismatch(
  offeredSemesters: unknown,
  semesterNumber: number // 1 = סמסטר א', 2 = סמסטר ב', etc. (0 = סמסטר 0)
): { hasMismatch: boolean; message?: string } {
  if (semesterNumber <= 0 || semesterNumber >= 999) return { hasMismatch: false };

  const list = Array.isArray(offeredSemesters)
    ? offeredSemesters.filter((x): x is string => typeof x === 'string')
    : typeof offeredSemesters === 'string'
    ? [offeredSemesters]
    : [];
  const set = new Set(list.map(normalizeSemesterName).filter(Boolean));
  const w = set.has('winter');
  const s = set.has('spring');

  const isWinterSemester = semesterNumber % 2 !== 0; // 1, 3, 5, 7, 9...
  const isSpringSemester = semesterNumber % 2 === 0;  // 2, 4, 6, 8, 10...

  // Course is winter only, but placed in a spring semester
  if (w && !s && isSpringSemester) {
    return {
      hasMismatch: true,
      message: 'אי-התאמה לעונת ההוראה: הקורס ניתן בחורף בלבד, אך ממוקם בסמסטר אביב (סמסטר זוגי)',
    };
  }

  // Course is spring only, but placed in a winter semester
  if (s && !w && isWinterSemester) {
    return {
      hasMismatch: true,
      message: 'אי-התאמה לעונת ההוראה: הקורס ניתן באביב בלבד, אך ממוקם בסמסטר חורף (סמסטר אי-זוגי)',
    };
  }

  return { hasMismatch: false };
}


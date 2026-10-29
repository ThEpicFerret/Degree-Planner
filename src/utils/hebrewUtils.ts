export const SEMESTER_0_NAME = 'סמסטר 0';

export const numberToHebrewLetter = (num: number, useGeresh: boolean = false): string => {
  if (num <= 0) return '0';
  // Simple mapping for 1-22 (Aleph to Tav). Extend if more are needed.
  const letters = [
    'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 
    'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ', 'ק', 'ר', 'ש', 'ת'
  ];
  const mark = useGeresh ? '׳' : "'";
  if (num > letters.length) return num.toString() + mark;
  return letters[num - 1] + mark;
};

export const getSemesterOrderIndex = (semesterName: string): number => {
  if (!semesterName) return 999;
  if (semesterName === SEMESTER_0_NAME || semesterName.includes('סמסטר 0') || semesterName.includes('0')) {
    return 0; // Semester 0 comes before Semester א'
  }
  const match = semesterName.match(/([א-ת])['׳]?$/) || semesterName.match(/סמסטר\s+([א-ת])['׳]?/);
  if (match) {
    const letters = [
      'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 
      'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ', 'ק', 'ר', 'ש', 'ת'
    ];
    const idx = letters.indexOf(match[1]);
    if (idx !== -1) return idx + 1; // א is 1, ב is 2...
  }
  const numMatch = semesterName.match(/(\d+)/);
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    if (!isNaN(n)) return n;
  }
  return 999;
};

export const sortSemesterEntries = <T>(entries: [string, T][]): [string, T][] => {
  return [...entries].sort((a, b) => getSemesterOrderIndex(a[0]) - getSemesterOrderIndex(b[0]));
};

import React, { useState, useMemo } from 'react';
import { RawCourseData, DegreeRule } from '../../types/data';
import { SemesterOfferingBadge } from './SemesterOfferingBadge';
import { PanelSlot, PanelSlotSwitcher, getPanelSlotStyle } from './PanelSlotSwitcher';

interface ElectiveListsSidebarProps {
  courseLists?: Record<string, string[]>;
  degreeName?: string;
  rules?: DegreeRule[];
  allCourses: RawCourseData[];
  semesters?: Record<string, string[]>;
  selectedCourseIds: Set<string>;
  onCourseClick: (courseId: string) => void;
  onCourseInfoClick: (course: RawCourseData) => void;
  onCourseRemoveClick: (courseId: string) => void;
  isOpen?: boolean;
  onToggleOpen?: () => void;
  hideFloatingButton?: boolean;
  slot?: PanelSlot;
  onSlotChange?: (slot: PanelSlot) => void;
}

const ME_COURSE_BASE_PLAN_WARNINGS: Record<string, string> = {
  '01140071': "מחליף את פיזיקה 1 (01140051) בסמסטר א'",
  '01140075': "מחליף את פיזיקה 2 (01140052) בסמסטר ב' ודורש פיזיקה 1מ' (01140071)",
  '01040223': "מחליף את מד\"ח (01040228) בסמסטר ג'",
  '01140073': "דורש שינוי בתוכנית הבסיס: פיזיקה 1מ' (01140071) ופיזיקה 2ממ' (01140075) במקום פיזיקה 1 ו-2",
  '01140086': "דורש שינוי בתוכנית הבסיס: פיזיקה 1מ' (01140071) ופיזיקה 2ממ' (01140075) במקום פיזיקה 1 ו-2",
  '00350052': "דורש שינוי בתוכנית הבסיס: פיזיקה 1מ' (01140071) ופיזיקה 2ממ' (01140075) במקום פיזיקה 1 ו-2",
  '00340422': "דורש אופטיקה לינארית 1 (00350052) -> מחייב פיזיקה 1מ' (01140071) ופיזיקה 2ממ' (01140075)",
  '00460241': "דורש שינוי בתוכנית הבסיס: פיזיקה 1מ' (01140071) ופיזיקה 2ממ' (01140075)",
  '01140036': "דורש פיזיקה קוונטית (01140073) ופיזיקה 2ממ' (01140075)",
  '01160041': "דורש פיזיקה קוונטית (01140073) ופיזיקה 2ממ' (01140075)",
  '00340401': "דורש קדם מרשימות הבחירה שאינו בתוכנית החובה: מבוא לרובוטיקה (00350001)",
  '00340404': "דורש קדם מרשימות הבחירה שאינו בתוכנית החובה: מבוא למכטרוניקה (00350188)",
  '00340406': "דורש קדם מרשימות הבחירה שאינו בתוכנית החובה: עיבוד שבבי (00350046)",
  '00340411': "דורש קדם מרשימות הבחירה שאינו בתוכנית החובה: בקרה לינארית מודרנית (00350148)",
  '00850407': "ליבת אוירונוטיקה — בחירה בין מנועי סילון (00850407) להנעה רקטית (00850406)",
  '00850406': "בחירה בין הנעה רקטית (00850406) למנועי סילון / הנעה חשמלית (00850407 / 00850920)",
  '00850920': "ליבת אסטרונאוטיקה — בחירה בין הנעה חשמלית (00850920) להנעה רקטית (00850406)",
  '00840143': "קורס חובה לבוחרי אשכול תכן והנדסת מערכות",
  '01140074': "מחליף את פיסיקה 1 (01140051) בתואר משולב עם פיזיקה",
  '01140076': "מחליף את פיסיקה 2 (01140052) בתואר משולב עם פיזיקה",
  '01040012': "מחליף את חדו\"א 1מ' (01040047) בתואר משולב עם פיזיקה",
  '01040013': "מחליף את חדו\"א 2מ' (01040043) בתואר משולב עם פיזיקה",
};

const getListRequirementNote = (name: string): string | null => {
  if (name.includes("רשימה א'")) {
    return "דרישה: לפחות קורס 1 (א'+ד' – לפחות קורס 1 מכל רשימה)";
  }
  if (name.includes("רשימה ב'")) {
    return "דרישה: לפחות 2 קורסים (ב'+ג' – לפחות 2 קורסים; לפחות 14 נק״ז מרשימות ב,ג,ד)";
  }
  if (name.includes("רשימה ג'")) {
    return "דרישה: לפחות 2 קורסים (ב'+ג' – לפחות 2 קורסים; לפחות 14 נק״ז מרשימות ב,ג,ד)";
  }
  if (name.includes("רשימה ד'")) {
    return "דרישה: לפחות קורס 1 (א'+ד' – לפחות קורס 1 מכל רשימה; לפחות 14 נק״ז מרשימות ב,ג,ד)";
  }
  if (name.includes('אוריינות דיגיטלית')) {
    return 'בחירה חופשית / העשרה — אין חובת קורס מאשכול זה';
  }
  if (name.includes('פרויקט גמר') || name.includes('פרויקט תכן גמר')) {
    return 'חובה 6 נק״ז (פרויקט שנתי 7 ו-8: אוירונוטיקה או אסטרונאוטיקה)';
  }
  if (name.includes('ליבה אווירונוטיקה')) {
    return 'מקצועות ברירה ליבה (7.5 נק״ז): מכניקת הטייס 1+2, הנעה רקטית או מנועי סילון';
  }
  if (name.includes('ליבה אסטרונאוטיקה')) {
    return 'מקצועות ברירה ליבה (8.5 נק״ז): יסודות הנדסת חלל, מכניקת גופים בחלל, הנעה רקטית או חשמלית';
  }
  if (name.includes('שיטות ניסוי מתקדמות')) {
    return 'חובה קורס מעבדה 1 מתוך הרשימה (2.5 נק״ז)';
  }
  if (name.includes('סמינריון')) {
    return 'חובה סמינריון 1 בלבד (1.0 נק״ז)';
  }
  if (name.includes('אשכול')) {
    if (name.includes('הנעה והמרת אנרגיה')) {
      return 'אשכול בחירה (לפחות 8 נק״ז באשכול; חובה: הנעה רקטית 00850406 ומנועי סילון 00850407)';
    }
    if (name.includes('תכן והנדסת מערכות')) {
      return 'אשכול בחירה (לפחות 8 נק״ז באשכול; חובה: הנדסת מערכות אויר-חלל 00840143)';
    }
    return 'אשכול בחירה פקולטי (לפחות 8 נק״ז באשכול, סה״כ 24 נק״ז ב-3 אשכולות)';
  }
  if (name.includes('פיזיקה - רשימה 2')) {
    return 'לפחות 10.5 נק״ז מרשימה זו (לתואר כפול פיזיקה)';
  }
  if (name.includes('פיזיקה - רשימה 3')) {
    return 'לפחות 2.0 נק״ז מרשימה זו (לתואר כפול פיזיקה)';
  }
  if (name.includes('רובוטיקה')) {
    return 'תכנית התמחות מִשְׁנֵה בינפקולטית (27 נק״ז מתוך רשימות 1-5)';
  }
  if (name.toLowerCase().includes('unknown') || name.includes('בחירה חופשית')) {
    return 'בחירה חופשית (4 נק״ז לתואר) — ללא דרישות קדם, ניתן להירשם בכל שנה';
  }
  return null;
};

export const ElectiveListsSidebar: React.FC<ElectiveListsSidebarProps> = ({
  courseLists,
  degreeName,
  rules,
  allCourses,
  semesters,
  selectedCourseIds,
  onCourseClick,
  onCourseInfoClick,
  onCourseRemoveClick,
  isOpen: controlledIsOpen,
  onToggleOpen,
  hideFloatingButton = false,
  slot = 1,
  onSlotChange,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState<boolean>(true);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const handleToggle = () => {
    if (onToggleOpen) {
      onToggleOpen();
    } else {
      setInternalIsOpen(prev => !prev);
    }
  };
  const [searchQuery, setSearchQuery] = useState<string>('');
  const storageKey = 'degreePlanner_open_electives_v2';

  // By default when first opened: empty map {} -> ALL lists are collapsed!
  // Remembers expanded/collapsed state across reopens and sessions.
  const [openLists, setOpenLists] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      // fallback
    }
    return {};
  });

  const courseMap = useMemo(() => {
    const map = new Map<string, RawCourseData>();
    for (const c of allCourses) {
      map.set(c._id, c);
    }
    return map;
  }, [allCourses]);

  // Map exact courseId -> semester name where it is placed
  const coursePlacementMap = useMemo(() => {
    const placement = new Map<string, { semesterKey: string; placedId: string }>();
    if (!semesters) return placement;

    for (const [semKey, courseIds] of Object.entries(semesters)) {
      for (const cid of courseIds) {
        placement.set(cid, { semesterKey: semKey, placedId: cid });
      }
    }
    return placement;
  }, [semesters]);

  // Extract list requirements from selective_lists_rule if available
  const listRequirements = useMemo(() => {
    const reqMap: Record<string, { min?: number; minCredits?: number }> = {};
    if (!rules) return reqMap;
    for (const r of rules) {
      if (r.type === 'minCoursesFromMultipleLists' && Array.isArray(r.lists)) {
        for (const item of r.lists) {
          reqMap[item.listName] = { min: item.min, minCredits: item.minCredits };
        }
      }
    }
    return reqMap;
  }, [rules]);

  if (!courseLists || Object.keys(courseLists).length === 0) {
    return null;
  }

  const listEntries = Object.entries(courseLists);

  const toggleListCollapse = (listName: string) => {
    setOpenLists(prev => {
      const next = { ...prev, [listName]: !prev[listName] };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    for (const [name] of listEntries) next[name] = true;
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
    setOpenLists(next);
  };

  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    for (const [name] of listEntries) next[name] = false;
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
    setOpenLists(next);
  };

  const isAerospace = Boolean(
    degreeName?.includes('אוירונוטיקה') ||
    degreeName?.includes('אווירונוטיקה') ||
    (courseLists && Object.keys(courseLists).some(k => k.includes('אווירונוטיקה') || k.includes('אסטרונאוטיקה') || k.includes('אוירודינמיקה')))
  );
  const isMechanical = Boolean(
    degreeName?.includes('מכונות') ||
    (!isAerospace && courseLists && Object.keys(courseLists).some(k => k.includes("רשימה א'")))
  );
  const sidebarHeaderTitle = isAerospace
    ? '📚 רשימות בחירה (הנדסת אוירונוטיקה וחלל)'
    : isMechanical
    ? '📚 רשימות בחירה (הנדסת מכונות)'
    : '📚 רשימות בחירה לתואר';

  return (
    <div
      dir="rtl"
      className="flex flex-col items-end pointer-events-none transition-all duration-200"
      style={{
        ...getPanelSlotStyle(slot),
        maxHeight: 'calc(100vh - 150px)',
      }}
    >
      {/* Optional Floating Toggle Button (hidden when using Bottom HUD Bar) */}
      {!hideFloatingButton && (
        <button
          onClick={handleToggle}
          className="pointer-events-auto flex items-center gap-2 px-3.5 py-2 rounded-lg shadow-md backdrop-blur-md bg-blue-600/95 hover:bg-blue-700 text-white text-xs font-semibold transition-all duration-200 mb-2"
          title="רשימות בחירה לתואר (לחץ לפתיחה/סגירה)"
        >
          <span>📚 רשימות בחירה לתואר</span>
          <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded">
            {isOpen ? 'הסתר ▲' : 'הצג ▼'}
          </span>
        </button>
      )}

      {/* Collapsible Sidebar Body */}
      {isOpen && (
        <div
          className="pointer-events-auto w-[320px] sm:w-[340px] bg-white/95 dark:bg-gray-900/95 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl backdrop-blur-md flex flex-col overflow-hidden"
          style={{ maxHeight: 'calc(100vh - 155px)' }}
        >
          {/* Sidebar Header & Search */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-blue-50/70 dark:bg-gray-800/90 space-y-2">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-bold text-gray-800 dark:text-gray-100 truncate">
                {sidebarHeaderTitle}
              </span>
              <button
                onClick={handleToggle}
                className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 font-bold px-1.5 py-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10"
                title="סגור חלונית"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center justify-between gap-1 pt-0.5">
              <PanelSlotSwitcher
                currentSlot={slot}
                onSlotChange={onSlotChange || (() => {})}
                colorScheme="blue"
              />
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  onClick={expandAll}
                  className="text-blue-600 dark:text-blue-400 hover:underline px-1"
                >
                  פרוס
                </button>
                <span className="text-gray-400">|</span>
                <button
                  onClick={collapseAll}
                  className="text-blue-600 dark:text-blue-400 hover:underline px-1"
                >
                  כווץ
                </button>
              </div>
            </div>

            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="חפש קורס לפי שם או מספר..."
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">
              לחיצה על קורס <span className="text-red-600 dark:text-red-400 font-semibold">אדום (לא נלקח)</span> תוסיף אותו לסמסטר הראשון שבו מתקיימים תנאי הקדם שלו. לחיצה על קורס <span className="text-green-600 dark:text-green-400 font-semibold">ירוק (נלקח)</span> תדגיש אותו ואת שרשרת הקורסים שלו במפה.
            </p>

            {/* Official Catalog Requirements Card */}
            {isAerospace && (
              <div className="p-2.5 rounded-lg bg-blue-100/70 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-[11px] space-y-1.5 text-blue-950 dark:text-blue-100">
                <div className="font-bold flex items-center gap-1.5 text-xs text-blue-900 dark:text-blue-200">
                  <span>📋 דרישות קטלוג אוירונוטיקה וחלל (תשפ״ז):</span>
                </div>
                <ul className="space-y-1 pr-1 text-blue-850 dark:text-blue-300">
                  <li className="flex items-start gap-1.5">
                    <span className="font-bold text-blue-600 dark:text-blue-400">•</span>
                    <span><strong>מקצועות ברירה (17–18 נק״ז):</strong> חובה לבחור קבוצת ליבה אחת (אווירונוטיקה 7.5 נק׳ או אסטרונאוטיקה 8.5 נק׳), שיטות ניסוי מתקדמות (2.5 נק׳), פרויקט תכן גמר שנתי 7+8 (6 נק׳) וסמינריון (1 נק׳).</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="font-bold text-blue-600 dark:text-blue-400">•</span>
                    <span><strong>מקצועות בחירה (34.5–35.5 נק״ז):</strong> לפחות <strong>24 נק״ז בשלושה מתוך 7 האשכולות</strong> (לפחות 8 נק״ז בכל אשכול). שאר הנקודות מכלל מקצועות הבחירה (עד 9 נק״ז מפקולטות אחרות).</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="font-bold text-blue-600 dark:text-blue-400">•</span>
                    <span><strong>בחירה כלל-טכניונית (12 נק״ז):</strong> 4 נק״ז בחירה חופשית, 6 נק״ז מל״ג/העשרה, 2 נק״ז חנ״ג.</span>
                  </li>
                </ul>
              </div>
            )}

            {isMechanical && (
              <div className="p-2.5 rounded-lg bg-blue-100/70 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-[11px] space-y-1.5 text-blue-950 dark:text-blue-100">
                <div className="font-bold flex items-center gap-1.5 text-xs text-blue-900 dark:text-blue-200">
                  <span>📋 דרישות קטלוג (קורסים מתקדמים - בחירה מצומצמת):</span>
                </div>
                <ul className="space-y-1 pr-1 text-blue-850 dark:text-blue-300">
                  <li className="flex items-start gap-1.5">
                    <span className="font-bold text-blue-600 dark:text-blue-400">•</span>
                    <span><strong>רשימות א'+ד':</strong> לפחות <strong>קורס אחד</strong> מכל רשימה (1 מא' ו-1 מד').</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="font-bold text-blue-600 dark:text-blue-400">•</span>
                    <span><strong>רשימות ב'+ג':</strong> לפחות <strong>שני קורסים</strong> מכל רשימה (2 מב' ו-2 מג').</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="font-bold text-blue-600 dark:text-blue-400">•</span>
                    <span><strong>רשימות ב', ג', ד':</strong> יש לצבור לפחות <strong>14 נק״ז</strong> במצטבר מתוך שלוש הרשימות.</span>
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* Scrollable Lists */}
          <div className="overflow-y-auto p-2.5 space-y-2.5 flex-1">
            {listEntries.map(([listName, courseIds]) => {
              const q = searchQuery.trim().toLowerCase();
              const isListNameMatch = !!q && (
                listName.toLowerCase().includes(q) ||
                (listName.toLowerCase().includes('unknown') && (q.includes('חופשית') || q.includes('unknown')))
              );

              const filteredIds = courseIds.filter(cid => {
                if (!q) return true;
                if (isListNameMatch) return true;
                const c = courseMap.get(cid);
                return (
                  cid.toLowerCase().includes(q) ||
                  (c?.name && c.name.toLowerCase().includes(q))
                );
              });

              if (searchQuery.trim() && filteredIds.length === 0) {
                return null;
              }

              const takenCourses = courseIds.filter(cid => coursePlacementMap.has(cid));
              const takenCredits = takenCourses.reduce(
                (sum, cid) => sum + (Number(courseMap.get(cid)?.credits) || 0),
                0
              );
              const req = listRequirements[listName];
              const isCollapsed = !openLists[listName] && !searchQuery.trim();

              let reqBadgeText = `${takenCourses.length} נבחרו (${takenCredits} נק"ז)`;
              let isReqMet = takenCourses.length > 0;
              if (req?.min !== undefined) {
                reqBadgeText = `${takenCourses.length}/${req.min} קורסים (${takenCredits} נק"ז)`;
                isReqMet = takenCourses.length >= req.min;
              } else if (req?.minCredits !== undefined) {
                reqBadgeText = `${takenCredits}/${req.minCredits} נק"ז`;
                isReqMet = takenCredits >= req.minCredits;
              }

              return (
                <div
                  key={listName}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800/70"
                >
                  {/* List Accordion Header */}
                  <button
                    onClick={() => toggleListCollapse(listName)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-gray-100/80 dark:bg-gray-800 hover:bg-gray-200/70 dark:hover:bg-gray-700/80 transition-colors text-right"
                  >
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-800 dark:text-gray-100">
                          {listName}
                        </span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400">
                          ({filteredIds.length})
                        </span>
                      </div>
                      {getListRequirementNote(listName) && (
                        <div className="text-[10px] text-blue-700 dark:text-blue-300 font-medium leading-tight mt-0.5">
                          {getListRequirementNote(listName)}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          isReqMet
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                        }`}
                      >
                        {reqBadgeText}
                      </span>
                      <span className="text-xs text-gray-500">
                        {isCollapsed ? '▼' : '▲'}
                      </span>
                    </div>
                  </button>

                  {/* Courses inside List */}
                  {!isCollapsed && (
                    <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
                      {filteredIds.map(cid => {
                        const course = courseMap.get(cid);
                        const placement = coursePlacementMap.get(cid);
                        const isTaken = !!placement;
                        const isSelected =
                          selectedCourseIds.has(cid) ||
                          (placement ? selectedCourseIds.has(placement.placedId) : false);

                        return (
                          <div
                            key={cid}
                            onClick={() => onCourseClick(placement ? placement.placedId : cid)}
                            className={`flex items-center justify-between px-2.5 py-2 cursor-pointer transition-colors text-xs ${
                              isSelected
                                ? 'bg-blue-50 dark:bg-blue-900/40 ring-1 ring-inset ring-blue-400'
                                : isTaken
                                ? 'bg-green-50/40 dark:bg-green-950/20 hover:bg-green-100/50 dark:hover:bg-green-900/30'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'
                            }`}
                          >
                            <div className="flex items-start gap-2 min-w-0 flex-1">
                              {/* Green / Red Status Badge */}
                              <span
                                className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                  isTaken
                                    ? 'bg-green-500 text-white'
                                    : 'bg-red-500 text-white'
                                }`}
                                title={
                                  isTaken
                                    ? `נלקח ב${placement.semesterKey} (לחץ להדגשת שרשרת הקורסים במפה)`
                                    : 'לא בתוכנית (לחץ להוספה לסמסטר הראשון האפשרי)'
                                }
                              >
                                {isTaken ? '✓' : '✗'}
                              </span>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-semibold text-gray-800 dark:text-gray-100 truncate">
                                    {course?.name || `קורס ${cid}`}
                                  </span>
                                  {ME_COURSE_BASE_PLAN_WARNINGS[cid] && (
                                    <span
                                      className="inline-flex items-center px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 text-[10px] font-bold border border-amber-300 dark:border-amber-700"
                                      title={ME_COURSE_BASE_PLAN_WARNINGS[cid]}
                                    >
                                      * שינוי בתוכנית הבסיס
                                    </span>
                                  )}
                                </div>
                                {ME_COURSE_BASE_PLAN_WARNINGS[cid] && (
                                  <div className="text-[10px] text-amber-700 dark:text-amber-400 font-medium mt-0.5 leading-tight">
                                    * {ME_COURSE_BASE_PLAN_WARNINGS[cid]}
                                  </div>
                                )}
                                <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                                  <span className="font-mono">{cid}</span>
                                  {course?.credits !== undefined && (
                                    <span>• {course.credits} נק"ז</span>
                                  )}
                                  <SemesterOfferingBadge semesters={course?.semesters || course?.semester} compact />
                                  {isTaken && (
                                    <span className="text-green-700 dark:text-green-400 font-semibold">
                                      • משובץ ב-{placement.semesterKey}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Action Buttons (Info & Remove) */}
                            <div
                              className="flex items-center gap-1 mr-1 flex-shrink-0"
                              onClick={e => e.stopPropagation()}
                            >
                              {course && (
                                <button
                                  onClick={() => onCourseInfoClick(course)}
                                  className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                                  title="פרטי קורס וסילבוס"
                                >
                                  ℹ️
                                </button>
                              )}
                              {isTaken && (
                                <button
                                  onClick={() => onCourseRemoveClick(placement.placedId)}
                                  className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400"
                                  title="הסר קורס מהתוכנית"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

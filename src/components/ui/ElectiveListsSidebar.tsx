import React, { useState, useMemo } from 'react';
import { RawCourseData, DegreeRule } from '../../types/data';
import { SemesterOfferingBadge } from './SemesterOfferingBadge';
import { PanelSlot, PanelSlotSwitcher, getPanelSlotStyle } from './PanelSlotSwitcher';

interface ElectiveListsSidebarProps {
  courseLists?: Record<string, string[]>;
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
};

export const ElectiveListsSidebar: React.FC<ElectiveListsSidebarProps> = ({
  courseLists,
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
  const [collapsedLists, setCollapsedLists] = useState<Record<string, boolean>>({});

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
    setCollapsedLists(prev => ({ ...prev, [listName]: !prev[listName] }));
  };

  const expandAll = () => setCollapsedLists({});
  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    for (const [name] of listEntries) next[name] = true;
    setCollapsedLists(next);
  };

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
                📚 רשימות בחירה (הנדסת מכונות)
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
          </div>

          {/* Scrollable Lists */}
          <div className="overflow-y-auto p-2.5 space-y-2.5 flex-1">
            {listEntries.map(([listName, courseIds]) => {
              const filteredIds = courseIds.filter(cid => {
                if (!searchQuery.trim()) return true;
                const q = searchQuery.trim().toLowerCase();
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
              const isCollapsed = !!collapsedLists[listName] && !searchQuery.trim();

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
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-800 dark:text-gray-100">
                        {listName}
                      </span>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">
                        ({filteredIds.length})
                      </span>
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
                                      • {placement.semesterKey}
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

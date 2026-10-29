import React, { useState, useMemo } from 'react';
import { RawCourseData, SpecializationPath } from '../../types/data';
import { SemesterOfferingBadge } from './SemesterOfferingBadge';
import { PanelSlot, PanelSlotSwitcher, getPanelSlotStyle } from './PanelSlotSwitcher';

interface SpecializationPathsSidebarProps {
  paths?: SpecializationPath[];
  comparisonPaths?: SpecializationPath[];
  comparisonBadgeLabel?: string;
  allCourses: RawCourseData[];
  semesters?: Record<string, string[]>;
  selectedCourseIds: Set<string>;
  onCourseClick: (courseId: string) => void;
  onCourseInfoClick: (course: RawCourseData) => void;
  onCourseRemoveClick: (courseId: string) => void;
  isOpen?: boolean;
  onToggleOpen?: () => void;
  hideFloatingButton?: boolean;
  title?: string;
  notice?: string;
  colorScheme?: 'emerald' | 'purple';
  slot?: PanelSlot;
  onSlotChange?: (slot: PanelSlot) => void;
}

const ME_COURSE_BASE_PLAN_WARNINGS: Record<string, string> = {
  '01140071': "מחליף את פיזיקה 1 (01140051) בסמסטר א' (לחיצה תחליף אוטומטית)",
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

export const SpecializationPathsSidebar: React.FC<SpecializationPathsSidebarProps> = ({
  paths,
  comparisonPaths,
  comparisonBadgeLabel,
  allCourses,
  semesters,
  selectedCourseIds,
  onCourseClick,
  onCourseInfoClick,
  onCourseRemoveClick,
  isOpen: controlledIsOpen,
  onToggleOpen,
  hideFloatingButton = false,
  title,
  notice,
  colorScheme = 'emerald',
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
  const [collapsedPaths, setCollapsedPaths] = useState<Record<string, boolean>>({});

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

  // Identify paths that have the exact same courses in the comparison set
  const identicalPathMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!paths || !comparisonPaths || comparisonPaths.length === 0) return map;

    for (const p of paths) {
      if (!p || !p.groups) continue;
      const pSet = new Set((p.groups || []).flatMap(g => g.courses || []));
      for (const compP of comparisonPaths) {
        if (!compP || !compP.groups) continue;
        const compSet = new Set((compP.groups || []).flatMap(g => g.courses || []));
        if (pSet.size === compSet.size && [...pSet].every(cid => compSet.has(cid))) {
          map.set(p.id, compP.name);
          break;
        }
      }
    }
    return map;
  }, [paths, comparisonPaths]);

  if (!paths || paths.length === 0) {
    return null;
  }

  const togglePathCollapse = (pathId: string) => {
    setCollapsedPaths(prev => ({ ...prev, [pathId]: !prev[pathId] }));
  };

  const expandAll = () => setCollapsedPaths({});
  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    for (const p of paths) next[p.id] = true;
    setCollapsedPaths(next);
  };

  const isPurple = colorScheme === 'purple';
  const headerBg = isPurple ? 'bg-purple-50/80 dark:bg-gray-800/90' : 'bg-emerald-50/70 dark:bg-gray-800/90';
  const linkTextClass = isPurple ? 'text-purple-600 dark:text-purple-400' : 'text-emerald-600 dark:text-emerald-400';
  const focusRing = isPurple ? 'focus:ring-purple-500' : 'focus:ring-emerald-500';
  const btnBg = isPurple ? 'bg-purple-600/95 hover:bg-purple-700' : 'bg-emerald-600/95 hover:bg-emerald-700';
  const defaultTitle = isPurple ? '📜 נתיבי התמחות ישנים' : '🧭 המלצות נתיבי התמחות';

  return (
    <div
      dir="rtl"
      className="flex flex-col items-start pointer-events-none transition-all duration-200"
      style={{
        ...getPanelSlotStyle(slot),
        maxHeight: 'calc(100vh - 150px)',
      }}
    >
      {/* Optional Floating Toggle Button (hidden when using Bottom HUD Bar) */}
      {!hideFloatingButton && (
        <button
          onClick={handleToggle}
          className={`pointer-events-auto flex items-center gap-2 px-3.5 py-2 rounded-lg shadow-md backdrop-blur-md text-white text-xs font-semibold transition-all duration-200 mb-2 ${btnBg}`}
          title={`${title || defaultTitle} (לחץ לפתיחה/סגירה)`}
        >
          <span>{title || defaultTitle} ({paths.length})</span>
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
          <div className={`p-3 border-b border-gray-200 dark:border-gray-700 ${headerBg} space-y-2`}>
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-bold text-gray-800 dark:text-gray-100 truncate">
                {title || defaultTitle}
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
                colorScheme={colorScheme}
              />
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  onClick={expandAll}
                  className={`${linkTextClass} hover:underline px-1`}
                >
                  פרוס
                </button>
                <span className="text-gray-400">|</span>
                <button
                  onClick={collapseAll}
                  className={`${linkTextClass} hover:underline px-1`}
                >
                  כווץ
                </button>
              </div>
            </div>

            {notice && (
              <div className="p-2 rounded-lg bg-amber-50/95 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-700/80 text-[11px] text-amber-900 dark:text-amber-200 leading-snug shadow-sm">
                📌 {notice}
              </div>
            )}

            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="חפש נתיב או קורס..."
              className={`w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 ${focusRing}`}
            />
            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">
              כל {paths.length} נתיבי ההתמחות מוצגים יחד: <span className="text-green-600 dark:text-green-400 font-semibold">ירוק (✓)</span> = הקורס בתוכנית (לחיצה תדגיש אותו במפה), <span className="text-red-600 dark:text-red-400 font-semibold">אדום (✗)</span> = לא נלקח (לחיצה תוסיף לסמסטר הראשון המתאים).
            </p>
          </div>

          {/* Scrollable Paths List */}
          <div className="overflow-y-auto p-2.5 space-y-3 flex-1">
            {paths.map(pathItem => {
              const q = searchQuery.trim().toLowerCase();
              const pathNameMatches =
                !q ||
                pathItem.name.toLowerCase().includes(q) ||
                (pathItem.description && pathItem.description.toLowerCase().includes(q));

              const filteredGroups = pathItem.groups
                .map(grp => ({
                  ...grp,
                  courses: grp.courses.filter(cid => {
                    if (!q || pathNameMatches) return true;
                    const c = courseMap.get(cid);
                    return (
                      cid.toLowerCase().includes(q) ||
                      (c?.name && c.name.toLowerCase().includes(q))
                    );
                  }),
                }))
                .filter(grp => grp.courses.length > 0);

              if (q && filteredGroups.length === 0) {
                return null;
              }

              const uniquePathCourseIds = Array.from(
                new Set(pathItem.groups.flatMap(g => g.courses))
              );
              const takenInPath = uniquePathCourseIds.filter(cid =>
                coursePlacementMap.has(cid)
              );
              const isCollapsed = !!collapsedPaths[pathItem.id] && !q;

              return (
                <div
                  key={pathItem.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800/70 shadow-sm"
                >
                  {/* Path Accordion Header */}
                  <button
                    onClick={() => togglePathCollapse(pathItem.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 ${
                      isPurple
                        ? 'bg-purple-50/80 dark:bg-purple-950/40 hover:bg-purple-100/70 dark:hover:bg-purple-900/50'
                        : 'bg-emerald-50/80 dark:bg-emerald-950/40 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/50'
                    } transition-colors text-right`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <span className="text-xs font-bold text-gray-800 dark:text-gray-100 truncate">
                        {pathItem.name}
                      </span>
                      {identicalPathMap.has(pathItem.id) && comparisonBadgeLabel && (
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
                            isPurple
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                              : 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300 border border-purple-300 dark:border-purple-700'
                          }`}
                          title={`נתיב זה כולל בדיוק את אותם הקורסים (${identicalPathMap.get(pathItem.id)})`}
                        >
                          {comparisonBadgeLabel}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                          takenInPath.length > 0
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-300'
                            : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {takenInPath.length}/{uniquePathCourseIds.length} בתוכנית
                      </span>
                      <span className="text-xs text-gray-500">
                        {isCollapsed ? '▼' : '▲'}
                      </span>
                    </div>
                  </button>

                  {/* Path Body */}
                  {!isCollapsed && (
                    <div className="p-2 space-y-2">
                      {pathItem.description && (
                        <p className="text-[11px] text-gray-600 dark:text-gray-400 px-1 leading-snug">
                          {pathItem.description}
                        </p>
                      )}

                      {filteredGroups.map(group => (
                        <div
                          key={group.category}
                          className="border border-gray-100 dark:border-gray-700/70 rounded-md overflow-hidden"
                        >
                          <div className="px-2 py-1 bg-gray-50 dark:bg-gray-800 text-[10px] font-bold text-gray-600 dark:text-gray-300">
                            {group.category}
                          </div>
                          <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                            {group.courses.map(cid => {
                              const course = courseMap.get(cid);
                              const placement = coursePlacementMap.get(cid);
                              const isTaken = !!placement;
                              const isSelected =
                                selectedCourseIds.has(cid) ||
                                (placement ? selectedCourseIds.has(placement.placedId) : false);

                              return (
                                <div
                                  key={cid}
                                  onClick={() =>
                                    onCourseClick(placement ? placement.placedId : cid)
                                  }
                                  className={`flex items-center justify-between px-2 py-1.5 cursor-pointer transition-colors text-xs ${
                                    isSelected
                                      ? 'bg-blue-50 dark:bg-blue-900/40 ring-1 ring-inset ring-blue-400'
                                      : isTaken
                                      ? 'bg-green-50/40 dark:bg-green-950/20 hover:bg-green-100/50 dark:hover:bg-green-900/30'
                                      : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'
                                  }`}
                                >
                                  <div className="flex items-start gap-2 min-w-0 flex-1">
                                    {/* Green / Red Status Dot */}
                                    <span
                                      className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                        isTaken
                                          ? 'bg-green-500 text-white'
                                          : 'bg-red-500 text-white'
                                      }`}
                                      title={
                                        isTaken
                                          ? `נלקח ב${placement.semesterKey} (לחץ להדגשה במפה)`
                                          : 'לא בתוכנית (לחץ להוספה לסמסטר הראשון המתאים)'
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

                                  {/* Info & Remove Buttons */}
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
                        </div>
                      ))}
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

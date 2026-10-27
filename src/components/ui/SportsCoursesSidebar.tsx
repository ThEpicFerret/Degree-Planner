import React, { useState, useEffect, useMemo } from 'react';
import { RawCourseData } from '../../types/data';
import { SemesterOfferingBadge } from './SemesterOfferingBadge';
import { getAssetUrl } from '../../utils/dataLoader';

interface SportGroupItem {
  group: number;
  code: string;
  title: string;
  day: string;
  time: string;
  instructor: string;
  semester: string;
}

interface SportCategory {
  activity: string;
  groups: SportGroupItem[];
}

interface SportCourseEntry {
  id: string;
  name: string;
  credits: string;
  syllabus: string;
  categories: SportCategory[];
}

interface SportsCoursesSidebarProps {
  allCourses: RawCourseData[];
  semesters?: Record<string, string[]>;
  selectedCourseIds: Set<string>;
  onCourseClick: (courseId: string) => void;
  onCourseInfoClick: (course: RawCourseData) => void;
  onCourseRemoveClick: (courseId: string) => void;
  isOpen?: boolean;
  onToggleOpen?: () => void;
  hideFloatingButton?: boolean;
}

export const SportsCoursesSidebar: React.FC<SportsCoursesSidebarProps> = ({
  allCourses,
  semesters,
  selectedCourseIds,
  onCourseClick,
  onCourseInfoClick,
  onCourseRemoveClick,
  isOpen: controlledIsOpen,
  onToggleOpen,
  hideFloatingButton = false,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState<boolean>(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const handleToggle = () => {
    if (onToggleOpen) {
      onToggleOpen();
    } else {
      setInternalIsOpen(prev => !prev);
    }
  };
  const [sportsData, setSportsData] = useState<SportCourseEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'sports' | 'malag'>('sports');
  const [expandedCourses, setExpandedCourses] = useState<Record<string, boolean>>({});
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch(getAssetUrl('data/sports_courses.json'))
      .then(res => (res.ok ? res.json() : []))
      .then((data: SportCourseEntry[]) => {
        if (Array.isArray(data)) {
          setSportsData(data);
        }
      })
      .catch(() => {
        // Ignore fetch errors silently
      });
  }, []);

  const courseMap = useMemo(() => {
    const map = new Map<string, RawCourseData>();
    for (const c of allCourses) {
      map.set(c._id, c);
    }
    return map;
  }, [allCourses]);

  // Exact courseId -> list of semesters where placed
  const coursePlacementMap = useMemo(() => {
    const placement = new Map<string, { semesterKeys: string[]; placedId: string }>();
    if (!semesters) return placement;

    for (const [semKey, courseIds] of Object.entries(semesters)) {
      for (const cid of courseIds) {
        const existing = placement.get(cid);
        if (existing) {
          existing.semesterKeys.push(semKey);
        } else {
          placement.set(cid, { semesterKeys: [semKey], placedId: cid });
        }
      }
    }
    return placement;
  }, [semesters]);

  const totalSportCoursesTaken = useMemo(() => {
    if (!semesters) return 0;
    let count = 0;
    for (const courseIds of Object.values(semesters)) {
      for (const cid of courseIds) {
        if (cid.startsWith('0394')) count++;
      }
    }
    return count;
  }, [semesters]);

  const malagCourses = useMemo(() => {
    return allCourses.filter(
      c => c._id.startsWith('032') && c._id !== '03240032' && c._id !== '03240033'
    );
  }, [allCourses]);

  const totalMalagCoursesTaken = useMemo(() => {
    if (!semesters) return 0;
    let count = 0;
    for (const courseIds of Object.values(semesters)) {
      for (const cid of courseIds) {
        if (cid.startsWith('032') && cid !== '03240032' && cid !== '03240033') count++;
      }
    }
    return count;
  }, [semesters]);

  const toggleCourse = (cid: string) => {
    setExpandedCourses(prev => ({ ...prev, [cid]: !prev[cid] }));
  };

  const toggleCategory = (catKey: string) => {
    setExpandedCategories(prev => ({ ...prev, [catKey]: !prev[catKey] }));
  };

  const expandAll = () => {
    const nextCourses: Record<string, boolean> = {};
    const nextCats: Record<string, boolean> = {};
    for (const sc of sportsData) {
      nextCourses[sc.id] = true;
      for (const cat of sc.categories) {
        nextCats[`${sc.id}::${cat.activity}`] = true;
      }
    }
    setExpandedCourses(nextCourses);
    setExpandedCategories(nextCats);
  };

  const collapseAll = () => {
    setExpandedCourses({});
    setExpandedCategories({});
  };

  if (sportsData.length === 0) {
    return null;
  }

  return (
    <div
      dir="rtl"
      className="fixed top-20 left-14 z-30 flex flex-col items-start pointer-events-none"
      style={{ maxHeight: 'calc(100vh - 150px)' }}
    >
      {/* Collapsible panel — opens on the left side, same spot as the specialization paths */}
      {isOpen && (
        <div
          className="pointer-events-auto w-80 sm:w-96 bg-white/95 dark:bg-gray-900/95 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl backdrop-blur-md flex flex-col overflow-hidden"
          style={{ maxHeight: 'calc(100vh - 155px)' }}
        >
          {/* Header */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-orange-50/90 dark:bg-gray-800/90 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveTab('sports')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                    activeTab === 'sports'
                      ? 'bg-orange-600 text-white shadow-sm'
                      : 'bg-white/70 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-orange-100'
                  }`}
                >
                  🏃 ספורט ואס"א ({totalSportCoursesTaken})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('malag')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                    activeTab === 'malag'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-white/70 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-purple-100'
                  }`}
                >
                  🎭 קורסי מל"ג ({totalMalagCoursesTaken})
                </button>
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                {activeTab === 'sports' && (
                  <>
                    <button
                      onClick={expandAll}
                      className="text-orange-600 dark:text-orange-400 hover:underline px-1"
                    >
                      פרוס הכל
                    </button>
                    <span className="text-gray-400">|</span>
                    <button
                      onClick={collapseAll}
                      className="text-orange-600 dark:text-orange-400 hover:underline px-1"
                    >
                      כווץ הכל
                    </button>
                    <span className="text-gray-400">|</span>
                  </>
                )}
                <button
                  onClick={handleToggle}
                  className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 font-bold px-1"
                  title="סגור חלונית"
                >
                  ✕
                </button>
              </div>
            </div>

            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === 'sports'
                  ? 'חפש ענף ספורט (שחייה, כדורסל, טניס...), יום או מדריך...'
                  : 'חפש קורס מל"ג / העשרה לפי שם או מספר (032)...'
              }
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />

            <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-2">
                <a
                  href="https://www.asatechnion.co.il/%d7%a7%d7%95%d7%a8%d7%a1%d7%99-%d7%a1%d7%a4%d7%95%d7%a8%d7%98-%d7%aa%d7%95%d7%90%d7%a8-%d7%a8%d7%90%d7%a9%d7%95%d7%9f/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-600 dark:text-orange-400 hover:underline font-medium"
                >
                  🔗 אתר קורסי ספורט אס"א
                </a>
                <span>•</span>
                <a
                  href="https://www.asatechnion.co.il/%D7%A0%D7%91%D7%97%D7%A8%D7%95%D7%AA-%D7%90%D7%A1%D7%90/#teams-asa"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-600 dark:text-orange-400 hover:underline font-medium"
                >
                  🏆 נבחרות אס"א טכניון
                </a>
              </div>
              <span className="text-[10px] text-gray-500">
                * מכסות פנויות מתעדכנות בזמן אמת במערכת ה-SAP בלבד
              </span>
            </div>
          </div>

          {/* Scrollable Sports / Malag List */}
          <div className="overflow-y-auto p-2.5 space-y-2.5 flex-1">
            {activeTab === 'malag' ? (
              <div className="divide-y divide-gray-100 dark:divide-gray-700/60 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800/70">
                {malagCourses
                  .filter(c => {
                    const q = searchQuery.trim().toLowerCase();
                    if (!q) return true;
                    return c._id.toLowerCase().includes(q) || (c.name && c.name.toLowerCase().includes(q));
                  })
                  .map(course => {
                    const placement = coursePlacementMap.get(course._id);
                    const isTaken = !!placement;
                    const isSelected = selectedCourseIds.has(course._id);
                    return (
                      <div
                        key={course._id}
                        onClick={() => onCourseClick(course._id)}
                        className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors text-xs ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-900/40 ring-1 ring-inset ring-blue-400'
                            : isTaken
                            ? 'bg-green-50/40 dark:bg-green-950/20 hover:bg-green-100/50'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span
                            className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              isTaken ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                            }`}
                          >
                            {isTaken ? '✓' : '+'}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-gray-800 dark:text-gray-100 truncate">
                              {course.name}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-gray-400">
                              <span className="font-mono">{course._id}</span>
                              {course.credits !== undefined && <span>• {course.credits} נק"ז</span>}
                              <SemesterOfferingBadge semesters={course.semesters || course.semester} compact />
                              {isTaken && (
                                <span className="text-green-700 dark:text-green-400 font-semibold">
                                  • {placement.semesterKeys.join(', ')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 mr-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => onCourseInfoClick(course)}
                            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                            title="פרטי קורס וסילבוס"
                          >
                            ℹ️
                          </button>
                          {isTaken && (
                            <button
                              type="button"
                              onClick={() => onCourseRemoveClick(course._id)}
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
            ) : (
            sportsData.map(sc => {
              const q = searchQuery.trim().toLowerCase();
              const courseMatches =
                !q || sc.id.toLowerCase().includes(q) || sc.name.toLowerCase().includes(q);

              const filteredCategories = sc.categories
                .map(cat => {
                  const catMatches = courseMatches || cat.activity.toLowerCase().includes(q);
                  const filteredGroups = cat.groups.filter(g => {
                    if (!q || catMatches) return true;
                    return (
                      g.title.toLowerCase().includes(q) ||
                      g.day.toLowerCase().includes(q) ||
                      g.time.toLowerCase().includes(q) ||
                      g.instructor.toLowerCase().includes(q) ||
                      g.code.toLowerCase().includes(q)
                    );
                  });
                  return {
                    ...cat,
                    groups: filteredGroups,
                  };
                })
                .filter(cat => cat.groups.length > 0);

              if (q && filteredCategories.length === 0 && !courseMatches) {
                return null;
              }

              const placement = coursePlacementMap.get(sc.id);
              const isTaken = !!placement;
              const isSelected = selectedCourseIds.has(sc.id);
              const isCourseExpanded = !!expandedCourses[sc.id] || !!q;
              const totalGroupsCount = sc.categories.reduce(
                (acc, c) => acc + c.groups.length,
                0
              );
              const rawCourse = courseMap.get(sc.id);

              return (
                <div
                  key={sc.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800/70 shadow-sm"
                >
                  {/* Top-Level Sport Course Row */}
                  <div
                    className={`flex items-center justify-between px-3 py-2 transition-colors ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-900/40 ring-1 ring-inset ring-blue-400'
                        : isTaken
                        ? 'bg-green-50/70 dark:bg-green-950/30'
                        : 'bg-gray-50/90 dark:bg-gray-800'
                    }`}
                  >
                    <div
                      className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
                      onClick={() => toggleCourse(sc.id)}
                    >
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          onCourseClick(sc.id);
                        }}
                        className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-transform hover:scale-110 ${
                          isTaken
                            ? 'bg-green-500 text-white'
                            : 'bg-red-500 text-white'
                        }`}
                        title={
                          isTaken
                            ? `נלקח ב-${placement.semesterKeys.join(', ')} (לחץ להדגשה במפה)`
                            : 'לא בתוכנית — לחץ להוספת קורס הספורט לסמסטר פנוי'
                        }
                      >
                        {isTaken ? '✓' : '+'}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-gray-800 dark:text-gray-100 truncate">
                          {sc.name}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-gray-400">
                          <span className="font-mono">{sc.id}</span>
                          <span>• {sc.credits} נק"ז</span>
                          <SemesterOfferingBadge semesters={rawCourse?.semesters || rawCourse?.semester} compact />
                          <span>• {totalGroupsCount} קבוצות</span>
                          {isTaken && (
                            <span className="text-green-700 dark:text-green-400 font-semibold">
                              • {placement.semesterKeys.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 mr-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => onCourseClick(sc.id)}
                        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-orange-100 hover:bg-orange-200 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200"
                        title={isTaken ? 'הדגש בתוכנית' : 'הוסף לתוכנית'}
                      >
                        {isTaken ? 'הדגש' : 'הוסף לתוכנית'}
                      </button>
                      {rawCourse && (
                        <button
                          type="button"
                          onClick={() => onCourseInfoClick(rawCourse)}
                          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs"
                          title="סילבוס ופרטי קורס"
                        >
                          ℹ️
                        </button>
                      )}
                      {isTaken && (
                        <button
                          type="button"
                          onClick={() => onCourseRemoveClick(sc.id)}
                          className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 text-xs"
                          title="הסר קורס מהתוכנית"
                        >
                          ✕
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleCourse(sc.id)}
                        className="p-1 text-xs text-gray-500"
                      >
                        {isCourseExpanded ? '▲' : '▼'}
                      </button>
                    </div>
                  </div>

                  {/* Sub-Activity Categories & Groups */}
                  {isCourseExpanded && (
                    <div className="p-2 space-y-1.5 bg-white dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700/60">
                      {filteredCategories.map(cat => {
                        const catKey = `${sc.id}::${cat.activity}`;
                        const isCatExpanded =
                          !!expandedCategories[catKey] ||
                          !!q ||
                          filteredCategories.length === 1;

                        return (
                          <div
                            key={catKey}
                            className="border border-gray-100 dark:border-gray-700/70 rounded-md overflow-hidden"
                          >
                            <button
                              type="button"
                              onClick={() => toggleCategory(catKey)}
                              className="w-full flex items-center justify-between px-2.5 py-1.5 bg-orange-50/50 dark:bg-gray-800/80 hover:bg-orange-100/50 dark:hover:bg-gray-700/70 text-right transition-colors"
                            >
                              <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200">
                                🏅 {cat.activity}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                                  {cat.groups.length} קבוצות
                                </span>
                                <span className="text-[10px] text-gray-500">
                                  {isCatExpanded ? '▲' : '▼'}
                                </span>
                              </div>
                            </button>

                            {isCatExpanded && (
                              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                {cat.groups.map(grp => (
                                  <div
                                    key={grp.code}
                                    onClick={() => onCourseClick(sc.id)}
                                    className="px-2.5 py-1.5 text-[11px] hover:bg-orange-50/40 dark:hover:bg-gray-800/60 cursor-pointer flex items-center justify-between gap-2"
                                    title="לחץ להוספת/הדגשת קורס הספורט בתוכנית"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-mono font-bold text-orange-700 dark:text-orange-400">
                                          קבוצה {grp.group}
                                        </span>
                                        <span className="font-medium text-gray-800 dark:text-gray-200 truncate">
                                          ({grp.title})
                                        </span>
                                      </div>
                                      <div className="text-[10px] text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-1.5 mt-0.5">
                                        <span>📅 יום {grp.day}</span>
                                        {grp.time && <span>• ⏰ {grp.time}</span>}
                                        {grp.instructor && <span>• 👤 {grp.instructor}</span>}
                                      </div>
                                    </div>
                                    <span className="text-[10px] text-orange-600 dark:text-orange-400 font-semibold flex-shrink-0">
                                      {isTaken ? 'בתוכנית ✓' : '+ שבץ'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }))}
          </div>
        </div>
      )}

      {/* Optional Toggle Button (hidden when using Bottom HUD Bar) */}
      {!hideFloatingButton && (
        <button
          onClick={handleToggle}
          className="pointer-events-auto flex items-center gap-2 px-3.5 py-2 rounded-lg shadow-md backdrop-blur-md bg-orange-600/95 hover:bg-orange-700 text-white text-xs font-semibold transition-all duration-200"
          title="קורסי ספורט, נבחרות אס״א ותזמורת (לחץ לפתיחה/סגירה)"
        >
          <span>🏃 קורסי ספורט ונבחרות אס"א ({sportsData.length})</span>
          <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded">
            {isOpen ? 'הסתר ▼' : 'הצג ▲'}
          </span>
        </button>
      )}
    </div>
  );
};

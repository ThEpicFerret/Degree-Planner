import React, { useMemo, useState } from 'react';
import { NodeProps, Node as RFNode } from '@xyflow/react';
import { DegreeTemplate, RawCourseData } from '../../../types/data';
import { calculateAllWeeklyHours } from '../../../utils/hoursCalculator';
import { sortSemesterEntries } from '../../../utils/hebrewUtils';

export interface WeeklyHoursNodeData extends Record<string, unknown> {
  currentTemplate: DegreeTemplate | undefined;
  allCourses: RawCourseData[];
}

const WeeklyHoursNode: React.FC<NodeProps<RFNode<WeeklyHoursNodeData>>> = ({ data }) => {
  const { currentTemplate, allCourses } = data;
  const [isExpanded, setIsExpanded] = useState(true);

  const { overallTotalHours, overallAverageHours, semesterCalculations } = useMemo(() => {
    return calculateAllWeeklyHours(currentTemplate, allCourses);
  }, [currentTemplate, allCourses]);

  const formatHours = (hours: number): string => {
    return hours % 1 === 0 ? hours.toString() : hours.toFixed(1);
  };

  return (
    <div
      dir="rtl"
      className="rule-node p-3 border-r-4 rounded-md shadow-lg w-[340px] bg-teal-50 dark:bg-slate-800/95 border-teal-500 dark:border-teal-400 text-gray-800 dark:text-gray-100 flex flex-col justify-between"
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold text-base text-teal-800 dark:text-teal-300 flex items-center gap-1.5">
            <span>⏱️ עומס שעות שבועיות (ש"ש)</span>
          </div>
          <button
            type="button"
            onClick={() => setIsExpanded(prev => !prev)}
            className="text-xs px-2 py-0.5 rounded bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 hover:bg-teal-200 dark:hover:bg-teal-800/60 transition-colors"
          >
            {isExpanded ? 'מזער ▲' : 'הרחב ▼'}
          </button>
        </div>

        <div className="flex items-center justify-between text-xs bg-white/70 dark:bg-gray-900/60 px-2.5 py-2 rounded border border-teal-200/70 dark:border-gray-700 mb-2">
          <div>
            <span className="text-gray-600 dark:text-gray-400">ממוצע לסמסטר פעיל: </span>
            <span className="font-bold text-sm text-teal-700 dark:text-teal-300 mr-1">
              {formatHours(overallAverageHours)} ש"ש
            </span>
          </div>
          <div className="text-gray-600 dark:text-gray-400 font-medium">
            סה"כ: <span className="font-bold text-gray-800 dark:text-gray-200">{formatHours(overallTotalHours)}</span> ש"ש
          </div>
        </div>

        {isExpanded && (
          <div className="space-y-1.5">
            {sortSemesterEntries(Object.entries(semesterCalculations)).map(([semesterKey, calc]) => (
              <div
                key={semesterKey}
                className="flex justify-between items-center text-xs py-1 px-2 rounded bg-white/50 dark:bg-gray-900/40 border-b border-gray-200/60 dark:border-gray-700/60 last:border-b-0"
              >
                <span className="font-medium text-gray-700 dark:text-gray-300 truncate ml-2">
                  {semesterKey}:
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">
                    ({formatHours(calc.lectureHours)} הר', {formatHours(calc.tutorialHours)} תר'
                    {calc.labHours > 0 ? `, ${formatHours(calc.labHours)} מעב'` : ''})
                  </span>
                  <span className="font-bold text-teal-700 dark:text-teal-300 w-12 text-left">
                    {formatHours(calc.totalHours)} ש"ש
                  </span>
                </div>
              </div>
            ))}
            {Object.keys(semesterCalculations).length === 0 && (
              <div className="text-xs text-center text-gray-500 py-2">אין סמסטרים להצגה</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WeeklyHoursNode;

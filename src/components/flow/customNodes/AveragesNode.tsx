import React, { useMemo, useState } from 'react';
import { NodeProps, Node as RFNode } from '@xyflow/react';
import { DegreeTemplate, RawCourseData } from '../../../types/data';
import { calculateAllAverages } from '../../../utils/averageCalculator';
import { sortSemesterEntries } from '../../../utils/hebrewUtils';

export interface AveragesNodeData extends Record<string, unknown> {
  currentTemplate: DegreeTemplate | undefined;
  allCourses: RawCourseData[];
  grades: Record<string, string>;
}

const AveragesNode: React.FC<NodeProps<RFNode<AveragesNodeData>>> = ({ data }) => {
  const { currentTemplate, allCourses, grades } = data;
  const [isExpanded, setIsExpanded] = useState(true);

  const { overallAverage, semesterCalculations } = useMemo(() => {
    if (!Array.isArray(allCourses) || !currentTemplate) {
      return { overallAverage: null, semesterCalculations: {} };
    }
    return calculateAllAverages(currentTemplate, allCourses, grades);
  }, [currentTemplate, allCourses, grades]);

  const formatAverage = (avg: number | null): string => {
    return avg === null ? '-' : avg.toFixed(2);
  };

  const formatCredits = (credits: number): string => {
    return credits % 1 === 0 ? credits.toString() : credits.toFixed(1);
  };

  const totalPlannedCredits = useMemo(() => {
    return Object.values(semesterCalculations).reduce((sum, calc) => sum + calc.totalCredits, 0);
  }, [semesterCalculations]);

  return (
    <div
      dir="rtl"
      className="rule-node p-3 border-r-4 rounded-md shadow-lg w-[340px] bg-blue-50 dark:bg-slate-800/95 border-blue-500 dark:border-blue-400 text-gray-800 dark:text-gray-100 flex flex-col justify-between"
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold text-base text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
            <span>📊 סיכום נק"ז וממוצע</span>
          </div>
          <button
            type="button"
            onClick={() => setIsExpanded(prev => !prev)}
            className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/60 transition-colors"
          >
            {isExpanded ? 'מזער ▲' : 'הרחב ▼'}
          </button>
        </div>

        <div className="flex items-center justify-between text-xs bg-white/70 dark:bg-gray-900/60 px-2.5 py-2 rounded border border-blue-200/70 dark:border-gray-700 mb-2">
          <div>
            <span className="text-gray-600 dark:text-gray-400">ממוצע כללי (משוקלל): </span>
            <span className="font-bold text-sm text-blue-700 dark:text-blue-300 mr-1">
              {formatAverage(overallAverage)}
            </span>
          </div>
          <div className="text-gray-600 dark:text-gray-400 font-medium">
            סה"כ: <span className="font-bold text-gray-800 dark:text-gray-200">{formatCredits(totalPlannedCredits)}</span> נק"ז
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
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 dark:text-gray-400 text-xs">
                    ({formatCredits(calc.totalCredits)} נק"ז)
                  </span>
                  <span className="font-bold text-gray-800 dark:text-gray-200 w-12 text-left">
                    {formatAverage(calc.average)}
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

export default AveragesNode;

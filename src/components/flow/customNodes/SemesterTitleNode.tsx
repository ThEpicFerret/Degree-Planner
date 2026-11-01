import React from 'react';
import { NodeProps, Node as RFNode } from '@xyflow/react';
import { SemesterTitleNodeData } from '../../../types/flow';

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
  </svg>
);

const SemesterTitleNode: React.FC<NodeProps<RFNode<SemesterTitleNodeData, 'semesterTitle'>>> = ({ data }) => {
  const handleRemoveClick = () => {
    if (data.onRemoveSemester) {
      data.onRemoveSemester(data.semesterKey);
    }
  };

  const handleToggleLock = () => {
    if (data.onToggleLock) {
      data.onToggleLock(data.semesterKey);
    }
  };

  const isLocked = Boolean(data.isLocked);
  const credits = data.credits !== undefined ? Number(data.credits) : 0;
  const weeklyHours = data.weeklyHours !== undefined ? Number(data.weeklyHours) : 0;

  const formatCredits = (c: number): string => (c % 1 === 0 ? c.toString() : c.toFixed(1));
  const formatHours = (h: number): string => (h % 1 === 0 ? h.toString() : h.toFixed(1));

  return (
    <div 
      dir="rtl"
      className={`semester-title-node p-1 w-[260px] text-center select-none pointer-events-none relative transition-colors duration-200 ${
        isLocked
          ? '!text-emerald-700 dark:!text-emerald-300'
          : '!text-gray-700 dark:!text-gray-200'
      }`}
    >
      <div className="flex flex-col items-center justify-center gap-1">
        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          <span className="!text-lg font-semibold">{data.title}</span>

          {/* Lock / Unlock Toggle Button */}
          {data.onToggleLock && (
            <button
              type="button"
              onClick={handleToggleLock}
              className={`pointer-events-auto px-1.5 py-0.5 text-xs rounded-full flex items-center gap-1 shadow-sm transition-all duration-150 active:scale-95 ${
                isLocked
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white font-bold ring-2 ring-emerald-300/60'
                  : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
              }`}
              title={isLocked ? 'סמסטר הושלם ונעול - לחץ לביטול נעילה' : 'נעל סמסטר כהושלם / נעול (מונע הוספת קורסים ומעדכן קדמים)'}
              aria-label={isLocked ? 'בטל נעילת סמסטר' : 'נעל סמסטר'}
            >
              <span>{isLocked ? '🔒 נעול' : '🔓 נעל'}</span>
            </button>
          )}

          {data.isEmpty && !isLocked && data.onRemoveSemester && (
            <button
              onClick={handleRemoveClick}
              className="pointer-events-auto mr-1 p-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center transition-colors duration-150"
              title={`מחק ${data.title}`}
              aria-label={`מחק ${data.title}`}
            >
              <TrashIcon />
            </button>
          )}
        </div>

        {/* Semester Points & Weekly Hours Summary */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold">
          <span
            className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700 shadow-xs"
            title="סך נקודות זכות (נק״ז) לסמסטר זה"
          >
            {formatCredits(credits)} נק״ז
          </span>
          <span
            className="px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950/70 text-teal-800 dark:text-teal-200 border border-teal-300 dark:border-teal-700 shadow-xs"
            title="סך שעות שבועיות (ש״ש) לסמסטר זה"
          >
            {formatHours(weeklyHours)} ש״ש
          </span>
        </div>
      </div>
    </div>
  );
};

export default SemesterTitleNode;   
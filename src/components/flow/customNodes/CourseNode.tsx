import React, { ChangeEvent, useState, useEffect, useRef } from 'react';
import { Handle, Position, NodeProps, Node as RFNode } from '@xyflow/react';
import { CourseNodeData } from '../../../types/flow';
import { PrereqStatus } from '../../../utils/prerequisiteChecker';
import { SemesterOfferingBadge } from '../../ui/SemesterOfferingBadge';

const CourseNode = ({ data, selected, dragging }: NodeProps<RFNode<CourseNodeData, 'course'>>) => {
  const [showPrereqTooltip, setShowPrereqTooltip] = useState(false);
  const [localGrade, setLocalGrade] = useState(data.grade || '');
  const debounceTimeoutRef = useRef<number | null>(null);

  // Sync local state with prop changes
  useEffect(() => {
    setLocalGrade(data.grade || '');
  }, [data.grade]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const handleGradeInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    
    // Update local state immediately for responsive UI
    setLocalGrade(value);
    
    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    // Debounce the parent state update
    debounceTimeoutRef.current = window.setTimeout(() => {
      // Always allow empty string
      if (value === '') {
        if (data.onGradeChange) data.onGradeChange(data.courseId, '');
        return;
      }
      
      // Allow intermediate typing states - only reject clearly invalid input
      // This allows partial numbers like "8" when typing "87"
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
        if (data.onGradeChange) data.onGradeChange(data.courseId, value); 
      } else {
        // If invalid, revert local state to last valid value
        setLocalGrade(data.grade || '');
      }
    }, 300); // 300ms debounce
  };

  const handleRemoveClick = () => {
    if (data.onRemoveCourse) data.onRemoveCourse(data.courseId);
  };

  const onInputMouseDown = (event: React.MouseEvent<HTMLDivElement | HTMLInputElement | HTMLButtonElement>) => {
    event.stopPropagation();
  };

  const onInputInteraction = (event: React.SyntheticEvent<HTMLInputElement>) => {
    event.stopPropagation();
  };

  const prereqStatus: PrereqStatus = data.prerequisitesMet;

  // Custom dedicated card for Bonus credits in Semester 0
  if (data.courseId === 'bonus_credits') {
    const rawVal = typeof data.credits === 'number' ? data.credits : parseFloat(String(data.credits)) || 0;
    const rounded = Math.max(0, Math.floor(rawVal * 2) / 2);
    const formatted = rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(1);

    const handleSetBonus = (newVal: number) => {
      const clamped = Math.max(0, Math.floor(newVal * 2) / 2);
      if (typeof data.onBonusCreditsChange === 'function') {
        data.onBonusCreditsChange(clamped);
      }
    };

    return (
      <div 
        dir="rtl"
        className="course-node relative shadow-md p-3 pl-4 pr-4 border-2 border-emerald-500/80 rounded-lg !bg-white dark:!bg-gray-800 w-[268px] min-h-[126px] transition-all duration-200 flex flex-col justify-between"
      >
        <div>
        {!data.isSemesterLocked && (
          <button 
            onClick={handleRemoveClick} 
            onMouseDown={onInputMouseDown} 
            className="absolute top-1 left-1 p-0.5 rounded-full !text-gray-400 hover:!bg-red-100 hover:!text-red-600 dark:hover:!bg-red-700 dark:hover:!text-red-200 transition-colors"
            aria-label="הסר קורס בונוסים"
            title="הסר קורס בונוסים"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
          <div className="font-bold text-sm text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5 mb-1">
            <span>🎁</span>
            <span>בונוסים (סמסטר 0)</span>
          </div>
          <div className="text-[11px] text-gray-600 dark:text-gray-400">
            נקודות זכות חופשיות לתואר (קפיצות 0.5)
          </div>
        </div>

        <div className="pt-1.5 border-t !border-gray-200 dark:!border-gray-700 flex items-center justify-between" onMouseDown={onInputMouseDown}>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleSetBonus(rounded - 0.5)}
              className="nodrag w-6 h-6 rounded bg-emerald-100 dark:bg-emerald-900/60 hover:bg-emerald-200 dark:hover:bg-emerald-800 text-emerald-800 dark:text-emerald-200 font-bold flex items-center justify-center text-xs transition-colors"
              title="הפחת 0.5 נקודות"
            >
              -
            </button>
            <input
              type="number"
              step="0.5"
              min="0"
              value={formatted}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) handleSetBonus(val);
              }}
              className="nodrag px-1 py-0.5 text-center text-xs font-bold w-14 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-emerald-800 dark:text-emerald-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              title="נקודות זכות בונוס"
            />
            <button
              type="button"
              onClick={() => handleSetBonus(rounded + 0.5)}
              className="nodrag w-6 h-6 rounded bg-emerald-100 dark:bg-emerald-900/60 hover:bg-emerald-200 dark:hover:bg-emerald-800 text-emerald-800 dark:text-emerald-200 font-bold flex items-center justify-center text-xs transition-colors"
              title="הוסף 0.5 נקודות"
            >
              +
            </button>
          </div>
          <span className="font-extrabold text-sm text-emerald-700 dark:text-emerald-300">
            {formatted} נק"ז
          </span>
        </div>
      </div>
    );
  }

  let statusBorderColor = selected ? '!border-blue-500 ring-2 ring-blue-500' : '!border-gray-300 dark:!border-gray-600';
  let statusIconColor = '';
  let statusTooltipText = '';

  if (prereqStatus === 'WARN_SAME_SEMESTER') {
    statusBorderColor = '!border-orange-500 dark:!border-orange-400 ring-1 ring-orange-500 dark:ring-orange-400';
    statusIconColor = 'text-orange-500 dark:text-orange-400';
    statusTooltipText = 'אחד או יותר מקדמי החובה נלקחים בסמסטר הנוכחי';
  } else if (prereqStatus === 'ERROR_LATER_SEMESTER' || prereqStatus === 'ERROR_NOT_IN_PLAN') {
    statusBorderColor = '!border-red-500 dark:!border-red-400 ring-1 ring-red-500 dark:ring-red-400';
    statusIconColor = 'text-red-500 dark:text-red-400';
    statusTooltipText = prereqStatus === 'ERROR_NOT_IN_PLAN' 
      ? 'אחד או יותר מקדמי החובה אינם בתוכנית' 
      : 'אחד או יותר מקדמי החובה נלקחים בסמסטר מאוחר יותר';
  }

  const highlightRole = data.highlightRole;
  let haloClasses = '';

  if (data.isSearchMatch) {
    haloClasses = '!border-amber-400 dark:!border-amber-300 ring-4 ring-amber-400/90 dark:ring-amber-300/90 shadow-[0_0_24px_rgba(251,191,36,0.95)] scale-[1.03] z-30';
  } else if (selected || highlightRole === 'selected') {
    haloClasses = '!border-blue-500 ring-2 ring-blue-500 shadow-[0_0_18px_rgba(59,130,246,0.85)]';
  } else if (highlightRole === 'prereq-direct') {
    // 1st order direct prerequisite - prominent glowing RED halo
    haloClasses = '!border-red-500 ring-2 ring-red-500 shadow-[0_0_16px_rgba(239,68,68,0.85)]';
  } else if (highlightRole === 'prereq-ancestor') {
    // 2nd+ order prerequisite ancestor - subtle red ring
    haloClasses = '!border-red-400/80 ring-1 ring-red-400/60 shadow-[0_0_8px_rgba(239,68,68,0.3)]';
  } else if (highlightRole === 'dep-direct') {
    // 1st order direct dependent (next course) - prominent glowing AMBER/ORANGE halo
    haloClasses = '!border-amber-500 ring-2 ring-amber-500 shadow-[0_0_16px_rgba(245,158,11,0.85)]';
  } else if (highlightRole === 'dep-descendant') {
    // 2nd+ order dependent descendant - subtle amber ring
    haloClasses = '!border-amber-400/80 ring-1 ring-amber-400/60 shadow-[0_0_8px_rgba(245,158,11,0.3)]';
  } else {
    haloClasses = statusBorderColor;
  }

  return (
    <div 
      dir="rtl"
      className={`course-node relative shadow-md p-3 pl-4 pr-4 border rounded-lg !bg-white w-[268px] min-h-[126px] 
                  dark:!bg-gray-800 dark:!border-gray-700 
                  ${haloClasses}
                  ${dragging ? 'opacity-70' : ''}
                  ${data.isSearchDimmed ? '!opacity-35 grayscale-[35%]' : ''}
                  transition-all duration-200
                  flex flex-col justify-between`}
    >
      <div> 
        {!data.isSemesterLocked && (
          <button 
            onClick={handleRemoveClick} 
            onMouseDown={onInputMouseDown} 
            className="absolute top-1 left-1 p-0.5 rounded-full !text-gray-400 hover:!bg-red-100 hover:!text-red-600 dark:hover:!bg-red-700 dark:hover:!text-red-200 transition-colors"
            aria-label="הסר קורס"
            title="הסר קורס"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        <div className="font-bold text-sm !text-gray-900 dark:!text-gray-100 mb-1 truncate flex items-center justify-between" title={data.label}>
          <div className="truncate flex items-center gap-1">
            <span className="truncate">{data.label}</span>
          </div>
          {data.isSearchMatch && (
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 border border-amber-500 shrink-0 mr-1 shadow-sm flex items-center gap-0.5 animate-pulse">
              <span>🔍</span>
              <span>נמצא</span>
            </span>
          )}
          {highlightRole === 'prereq-direct' && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-800 shrink-0 mr-1 shadow-sm">
              קדם ישיר
            </span>
          )}
          {highlightRole === 'prereq-ancestor' && data.highlightHop && (
            <span 
              className="text-[11px] font-extrabold px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-800 shrink-0 mr-1 shadow-sm leading-none"
              title={`קדם מדרגה ${data.highlightHop}`}
            >
              {data.highlightHop}
            </span>
          )}
          {highlightRole === 'dep-direct' && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-800 shrink-0 mr-1 shadow-sm">
              המשך ישיר
            </span>
          )}
          {highlightRole === 'dep-descendant' && data.highlightHop && (
            <span 
              className="text-[11px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-800 shrink-0 mr-1 shadow-sm leading-none"
              title={`המשך מדרגה ${data.highlightHop}`}
            >
              {data.highlightHop}
            </span>
          )}
        </div>
        <div className="text-xs !text-gray-700 dark:!text-gray-300 flex items-center justify-between">
          <span>מספר קורס: {data.courseId}</span>
          {data.earliestSemesterLetter && (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shrink-0 leading-none"
              title={`סמסטר מוקדם ביותר שבו ניתן לבחור את הקורס: סמסטר ${data.earliestSemesterLetter} (מס' ${data.earliestSemesterNumber})`}
            >
              החל מ-{data.earliestSemesterLetter}
            </span>
          )}
        </div>
        <div className="text-xs !text-gray-700 dark:!text-gray-300 flex items-center justify-between gap-1">
          <span className="font-medium">נק"ז: {data.credits}</span>
          {typeof data.weeklyHours === 'number' && data.weeklyHours > 0 ? (
            <span className="font-semibold text-teal-700 dark:text-teal-300">
              {data.weeklyHours} ש"ש
            </span>
          ) : null}
          <div className="flex items-center gap-1 shrink-0">
            {data.seasonMismatch && (
              <span 
                className="text-[12px] font-black px-1.5 py-0.5 rounded bg-red-600 text-white border border-red-700 shadow-sm leading-none flex items-center justify-center cursor-help animate-pulse"
                title={data.seasonMismatchMessage || 'אי-התאמה לעונת ההוראה: הקורס אינו מוצע בסמסטר זה'}
              >
                !
              </span>
            )}
            <SemesterOfferingBadge semesters={data.offeredSemesters} compact />
          </div>
        </div>

        {(prereqStatus === 'WARN_SAME_SEMESTER' || prereqStatus === 'ERROR_LATER_SEMESTER' || prereqStatus === 'ERROR_NOT_IN_PLAN') && (
          <div 
            className={`absolute bottom-1 left-1 ${statusIconColor}`}
            onMouseEnter={() => setShowPrereqTooltip(true)}
            onMouseLeave={() => setShowPrereqTooltip(false)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {showPrereqTooltip && (
              <div 
                className={`absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 min-w-max px-2 py-1 bg-gray-700 text-white text-xs rounded shadow-lg dark:bg-gray-900 dark:text-gray-200 border ${statusBorderColor.replace("!border-", "border-").replace("ring-1", "").replace(/ring-\S+/, "").trim()}`}
                style={{ whiteSpace: 'nowrap' }}
              >
                {statusTooltipText}
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="pt-1 border-t !border-gray-200 dark:!border-gray-700 flex items-center justify-start space-x-2" onMouseDown={onInputMouseDown}>
        <div className="flex items-center">
          <label htmlFor={`grade-${data.courseId}`} className="text-xs !text-gray-500 dark:!text-gray-400 ml-1">ציון:</label>
          <input 
            id={`grade-${data.courseId}`}
            type="number"
            value={localGrade}
            onChange={handleGradeInputChange}
            onMouseDown={onInputInteraction}
            onClick={onInputInteraction}
            onFocus={onInputInteraction}
            onKeyDown={onInputInteraction}
            min="0"
            max="100"
            step="1"
            placeholder="--"
            tabIndex={data.tabIndex}
            className="nodrag px-1 py-0.5 text-xs w-12 rounded border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:text-gray-400 dark:disabled:text-gray-500"
            aria-label={`ציון עבור ${data.label}`}
            disabled={data.isBinary}
          />
        </div>
        <div className="flex items-center">
          <input 
            type="checkbox"
            id={`binary-${data.courseId}`}
            checked={!!data.isBinary}
            onChange={(e) => data.onBinaryChange && data.onBinaryChange(data.courseId, e.target.checked)}
            onMouseDown={onInputInteraction}
            onClick={onInputInteraction}
            onFocus={onInputInteraction}
            className="nodrag w-3 h-3 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 dark:bg-gray-700 mr-2"
          />
          <label htmlFor={`binary-${data.courseId}`} className="mr-1.5 text-xs !text-gray-600 dark:!text-gray-400 select-none">
            פטור/בינארי
          </label>
        </div>
      </div>

      <Handle type="target" position={Position.Right} className="!bg-teal-500 w-2.5 h-2.5 rounded-full" />
      <Handle type="source" position={Position.Left} className="!bg-rose-500 w-2.5 h-2.5 rounded-full" />
    </div>
  );
};

export default CourseNode;

import React, { useState, useEffect } from 'react';
import { RawCourseData } from '../../types/data';
import { getSapCourseUrl } from '../../utils/sapUtils';

interface PrereqCourseIdWithTooltipProps {
  courseId: string;
  allCourses?: RawCourseData[];
  coursesInPlanIds?: Set<string>;
  semesters?: Record<string, string[]>;
  targetCourseSemesterKey?: string;
}

const PrereqCourseIdWithTooltip: React.FC<PrereqCourseIdWithTooltipProps> = ({
  courseId,
  allCourses,
  coursesInPlanIds,
  semesters,
  targetCourseSemesterKey,
}) => {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [courseName, setCourseName] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string>(' (לא בתוכנית)');
  const [statusStyle, setStatusStyle] = useState<string>('text-gray-800 dark:text-gray-200');
  
  const courseData = allCourses?.find(c => c._id === courseId || c._id === courseId.replace(/^0+/, '') || ('0' + c._id) === courseId);
  const isInPlan = coursesInPlanIds?.has(courseId) || false;
  const sapUrl = getSapCourseUrl(courseId, courseData);

  useEffect(() => {
    setCourseName(courseData?.name || courseId);

    let currentStatusStyle = 'text-gray-800 dark:text-gray-200';
    let currentStatusText = ' (לא בתוכנית)';

    if (isInPlan) {
      currentStatusStyle = 'text-green-700 dark:text-green-400 font-semibold'; 
      currentStatusText = ' (בתוכנית)';

      if (semesters && targetCourseSemesterKey && courseData) { 
        let prereqSemesterIndex = -1;
        let targetSemesterIndex = -1;
        const semesterKeys = Object.keys(semesters);
        targetSemesterIndex = semesterKeys.indexOf(targetCourseSemesterKey);

        for (const [key, courseIdsInSem] of Object.entries(semesters)) {
          if (courseIdsInSem.includes(courseId)) {
            prereqSemesterIndex = semesterKeys.indexOf(key);
            break;
          }
        }

        if (prereqSemesterIndex !== -1 && targetSemesterIndex !== -1) {
          if (prereqSemesterIndex === targetSemesterIndex) { 
            currentStatusStyle = 'text-orange-600 dark:text-orange-400 font-semibold';
            currentStatusText = ' (בסמסטר הנוכחי)';
          } else if (prereqSemesterIndex > targetSemesterIndex) { 
            currentStatusStyle = 'text-red-600 dark:text-red-400 font-semibold';
            currentStatusText = ' (בסמסטר מאוחר יותר)';
          }
        }
      }
    }
    setStatusStyle(currentStatusStyle);
    setStatusText(currentStatusText);
  }, [courseId, coursesInPlanIds, semesters, targetCourseSemesterKey, courseData, isInPlan]);

  const handleMouseEnter = () => {
    setTooltipVisible(true);
  };
  const handleMouseLeave = () => setTooltipVisible(false);

  const displayText = courseId;
  const baseBadgeStyle = "font-mono px-2 py-1 rounded text-sm shadow-sm relative transition-all";

  let badgeBorderColor = 'border border-gray-400/50';
  let badgeBgColor = 'bg-gray-500/10 hover:bg-gray-500/20';

  if (isInPlan) {
    if (statusStyle.includes('red')) {
      badgeBorderColor = 'border border-red-500/60';
      badgeBgColor = 'bg-red-500/10 hover:bg-red-500/20';
    } else if (statusStyle.includes('orange')) {
      badgeBorderColor = 'border border-orange-500/60';
      badgeBgColor = 'bg-orange-500/10 hover:bg-orange-500/20';
    } else if (statusStyle.includes('green')) {
      badgeBorderColor = 'border border-green-600/60';
      badgeBgColor = 'bg-green-500/10 hover:bg-green-500/20';
    }
  }

  const tooltipElement = tooltipVisible ? (
    <div 
      className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 text-xs font-medium text-white bg-gray-900/95 dark:bg-gray-100/95 dark:text-black rounded-md shadow-xl min-w-[170px] max-w-xs text-center z-50 pointer-events-none"
    >
      <div className="font-bold">{courseName || courseId}</div>
      <div className="text-[11px] mt-0.5">{statusText}</div>
      {(courseName && courseData?.credits !== undefined) && <div className="text-[11px]">נק״ז: {courseData.credits}</div>}
      <div className="mt-1.5 pt-1 border-t border-gray-700/80 dark:border-gray-300/80 text-[10px]">
        {sapUrl ? (
          <span className="text-blue-300 dark:text-blue-700 font-semibold inline-flex items-center gap-0.5">
            לחץ לפתיחה בסאפ (SAP) ↗
          </span>
        ) : (
          <span className="text-gray-400 dark:text-gray-500">
            קישור לסאפ: לא זמין
          </span>
        )}
      </div>
      <div className="absolute left-1/2 transform -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900/95 dark:border-t-gray-100/95"></div>
    </div>
  ) : null;

  if (sapUrl) {
    return (
      <a
        href={sapUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${baseBadgeStyle} ${statusStyle} ${badgeBorderColor} ${badgeBgColor} inline-flex items-center gap-1 cursor-pointer group no-underline hover:ring-2 hover:ring-blue-400 dark:hover:ring-blue-500`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={(e) => e.stopPropagation()}
        title="לחץ לפתיחת הקורס בסאפ (SAP)"
        aria-label={`Course: ${displayText} - פתח בסאפ`}
      >
        <span>{displayText}</span>
        <span className="text-[10px] text-blue-500 dark:text-blue-400 opacity-70 group-hover:opacity-100 transition-opacity">↗</span>
        {tooltipElement}
      </a>
    );
  }

  return (
    <span 
      className={`${baseBadgeStyle} ${statusStyle} ${badgeBorderColor} ${badgeBgColor} inline-flex items-center gap-1 cursor-default`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      aria-label={`Course: ${displayText}`}
    >
      <span>{displayText}</span>
      {tooltipElement}
    </span>
  );
};

export default PrereqCourseIdWithTooltip;

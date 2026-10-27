import React from 'react';
import { getSemesterOfferingInfo } from '../../utils/semesterOffering';

interface SemesterOfferingBadgeProps {
  semesters?: unknown;
  compact?: boolean;
}

export const SemesterOfferingBadge: React.FC<SemesterOfferingBadgeProps> = ({ semesters, compact = false }) => {
  const info = getSemesterOfferingInfo(semesters);
  if (info.isUnknown) {
    return (
      <span
        className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400 whitespace-nowrap"
        title={info.tooltip}
      >
        <span className="font-bold text-red-600 dark:text-red-400">?</span>
        <span>{compact ? 'סמסטר לא ידוע' : 'לא ידוע באיזה סמסטר ניתן'}</span>
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-300 whitespace-nowrap"
      title={info.tooltip}
    >
      <span>{info.emoji}</span>
      <span>{info.label}</span>
    </span>
  );
};

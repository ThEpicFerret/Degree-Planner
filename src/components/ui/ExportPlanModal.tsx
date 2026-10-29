import React, { useState } from 'react';
import BaseModal from './BaseModal';
import { DegreeTemplate, RawCourseData } from '../../types/data';
import { sortSemesterEntries, SEMESTER_0_NAME } from '../../utils/hebrewUtils';
import { calculateAllAverages } from '../../utils/averageCalculator';
import { calculateAllWeeklyHours } from '../../utils/hoursCalculator';

interface ExportPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  degreeTemplate?: DegreeTemplate;
  allCourses: RawCourseData[];
  grades: Record<string, string>;
  lockedSemesters?: Record<string, boolean>;
}

export const ExportPlanModal: React.FC<ExportPlanModalProps> = ({
  isOpen,
  onClose,
  degreeTemplate,
  allCourses,
  grades,
}) => {
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const handlePrintToPdf = () => {
    onClose();
    // Allow modal to close first so it is not visible in the print view
    setTimeout(() => {
      window.print();
    }, 250);
  };

  const handleExportHighResImage = async () => {
    if (!degreeTemplate || !degreeTemplate.semesters) return;
    setIsExportingImage(true);
    setExportStatus('מייצר תמונה ברזולוציה גבוהה...');

    try {
      const sortedSemesters = sortSemesterEntries(Object.entries(degreeTemplate.semesters));
      const { overallAverage, semesterCalculations } = calculateAllAverages(degreeTemplate, allCourses, grades);
      const { overallTotalHours } = calculateAllWeeklyHours(degreeTemplate, allCourses);

      // Canvas dimensions
      const scale = 2; // 2x high resolution (Retina quality)
      const colWidth = 270;
      const colGap = 16;
      const padding = 32;
      const headerHeight = 130;
      const cardHeight = 110;
      const cardGap = 12;
      const titleHeight = 44;

      const numCols = Math.max(1, sortedSemesters.length);
      const contentWidth = numCols * colWidth + (numCols - 1) * colGap;
      const totalWidth = contentWidth + padding * 2;

      // Find max courses in any semester to size height
      let maxCourses = 1;
      for (const [, cids] of sortedSemesters) {
        if (cids.length > maxCourses) maxCourses = cids.length;
      }
      const totalHeight = padding + headerHeight + titleHeight + maxCourses * (cardHeight + cardGap) + padding + 40;

      const canvas = document.createElement('canvas');
      canvas.width = totalWidth * scale;
      canvas.height = totalHeight * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Cannot get canvas context');

      ctx.scale(scale, scale);

      // Background
      ctx.fillStyle = '#f8fafc'; // slate-50
      ctx.fillRect(0, 0, totalWidth, totalHeight);

      // Header Banner
      ctx.fillStyle = '#1e293b'; // slate-800
      ctx.beginPath();
      ctx.roundRect(padding, padding, contentWidth, headerHeight - 16, 12);
      ctx.fill();

      // Header Text (RTL layout)
      ctx.direction = 'rtl';
      ctx.textAlign = 'right';

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
      ctx.fillText(degreeTemplate.name || 'תוכנית לימודים', totalWidth - padding - 24, padding + 38);

      ctx.font = '14px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#cbd5e1'; // slate-300
      const totalCreditsPlanned = Object.values(degreeTemplate.semesters)
        .flat()
        .reduce((sum, cid) => {
          if (cid === 'bonus_credits') return sum;
          const c = allCourses.find(x => x._id === cid);
          const cr = c ? Number(c.credits) : 0;
          return sum + (isNaN(cr) ? 0 : cr);
        }, 0);

      const subtitle = `סה״כ נק״ז מתוכננות: ${totalCreditsPlanned.toFixed(1)} נק״ז • שעות שבועיות כוללות: ${overallTotalHours} ש״ש • ${sortedSemesters.length} סמסטרים`;
      ctx.fillText(subtitle, totalWidth - padding - 24, padding + 68);

      // Stat badges on left of banner
      ctx.textAlign = 'left';
      ctx.direction = 'ltr';
      ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#38bdf8'; // sky-400
      if (overallAverage !== null) {
        ctx.fillText(`ממוצע משוקלל: ${overallAverage.toFixed(2)}`, padding + 24, padding + 45);
      }
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px system-ui, -apple-system, sans-serif';
      ctx.fillText(`הופק מ-DegreePlanner • ${new Date().toLocaleDateString('he-IL')}`, padding + 24, padding + 75);

      // Draw Semesters from Right to Left
      const startY = padding + headerHeight + 10;

      sortedSemesters.forEach(([semName, cids], colIndex) => {
        // RTL column placement: colIndex 0 (Semester 0 or Semester א') at far right
        const xPos = totalWidth - padding - (colIndex + 1) * colWidth - colIndex * colGap;

        // Semester Header
        const semCredits = semesterCalculations[semName]?.totalCredits || 0;
        ctx.direction = 'rtl';
        ctx.textAlign = 'right';
        ctx.fillStyle = semName === SEMESTER_0_NAME ? '#059669' : '#2563eb'; // emerald-600 or blue-600
        ctx.beginPath();
        ctx.roundRect(xPos, startY, colWidth, titleHeight - 6, 8);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
        ctx.fillText(semName, xPos + colWidth - 12, startY + 24);

        ctx.textAlign = 'left';
        ctx.direction = 'ltr';
        ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = '#e2e8f0';
        ctx.fillText(`${semCredits} נק״ז`, xPos + 12, startY + 24);

        // Course cards in this semester
        let cardY = startY + titleHeight;
        cids.forEach(cid => {
          const course = allCourses.find(c => c._id === cid);
          const grade = grades[cid];
          const isBonus = cid === 'bonus_credits';

          // Card background
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.roundRect(xPos, cardY, colWidth, cardHeight, 8);
          ctx.fill();

          ctx.strokeStyle = isBonus ? '#10b981' : '#e2e8f0';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Card content
          ctx.direction = 'rtl';
          ctx.textAlign = 'right';

          // Course title
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
          const courseTitle = isBonus ? '🎁 בונוסים (סמסטר 0)' : (course?.name || `קורס ${cid}`);
          // Truncate if long
          const displayTitle = courseTitle.length > 28 ? courseTitle.substring(0, 26) + '...' : courseTitle;
          ctx.fillText(displayTitle, xPos + colWidth - 12, cardY + 24);

          // Course ID
          ctx.fillStyle = '#64748b';
          ctx.font = '11px system-ui, -apple-system, sans-serif';
          ctx.fillText(isBonus ? 'נקודות חופשיות לתואר' : `מס׳: ${cid}`, xPos + colWidth - 12, cardY + 44);

          // Credits and Hours
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
          const crText = isBonus ? '' : `נק״ז: ${course?.credits ?? '-'}`;
          ctx.fillText(crText, xPos + colWidth - 12, cardY + 68);

          // Grade badge / Input
          if (grade) {
            ctx.fillStyle = '#dbeafe'; // blue-100
            ctx.beginPath();
            ctx.roundRect(xPos + 10, cardY + 12, 48, 22, 4);
            ctx.fill();

            ctx.direction = 'ltr';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#1d4ed8'; // blue-700
            ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
            ctx.fillText(grade, xPos + 34, cardY + 28);
          }

          cardY += cardHeight + cardGap;
        });
      });

      // Download PNG
      const link = document.createElement('a');
      link.download = `degree_plan_${degreeTemplate.id || 'export'}_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      setExportStatus('הורדת התמונה החלה בהצלחה!');
      setTimeout(() => {
        setIsExportingImage(false);
        setExportStatus(null);
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Failed to export image:', err);
      setExportStatus('שגיאה בייצוא התמונה');
      setIsExportingImage(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="ייצוא מפת הלימודים (PDF ותמונה ברזולוציה גבוהה)"
      maxWidth="max-w-md"
    >
      <div className="space-y-4 text-right" dir="rtl">
        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
          באפשרותך לייצא את מפת התואר המלאה כולל כל הסמסטרים, קורסי החובה והבחירה, השעות השבועיות, הנק״ז והציונים:
        </p>

        <div className="grid grid-cols-1 gap-3 pt-2">
          {/* PDF Option */}
          <button
            type="button"
            onClick={handlePrintToPdf}
            className="flex items-start gap-3 p-3.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/40 hover:bg-blue-100/80 dark:hover:bg-blue-900/60 transition-all text-right shadow-sm group"
          >
            <span className="text-2xl mt-0.5">📄</span>
            <div className="flex-1">
              <div className="font-bold text-sm text-blue-900 dark:text-blue-100 group-hover:underline">
                שמור כמסמך PDF (הדפסה לקובץ)
              </div>
              <div className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5">
                פותח את תיבת ההדפסה של הדפדפן מוכנה לשמירה כקובץ PDF לרוחב (Landscape) ללא סרגלי צד.
              </div>
            </div>
          </button>

          {/* High-Res PNG Image Option */}
          <button
            type="button"
            onClick={handleExportHighResImage}
            disabled={isExportingImage}
            className="flex items-start gap-3 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/60 transition-all text-right shadow-sm group disabled:opacity-60"
          >
            <span className="text-2xl mt-0.5">🖼️</span>
            <div className="flex-1">
              <div className="font-bold text-sm text-emerald-900 dark:text-emerald-100 group-hover:underline">
                הורד כתמונה ברזולוציה גבוהה (PNG)
              </div>
              <div className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                מייצר תמונה חדה ושלמה (Retina 2x) של כל המפה, הסמסטרים והסטטיסטיקות להדפסה ולשיתוף.
              </div>
            </div>
          </button>
        </div>

        {exportStatus && (
          <div className="p-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-center text-xs font-semibold text-gray-800 dark:text-gray-200 animate-pulse">
            {exportStatus}
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 transition-colors"
          >
            סגור
          </button>
        </div>
      </div>
    </BaseModal>
  );
};

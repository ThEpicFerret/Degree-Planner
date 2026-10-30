import React from 'react';
import BaseModal from './BaseModal';
import { RawCourseData, PrerequisiteGroup } from '../../types/data';
import PrereqCourseIdWithTooltip from './PrereqCourseIdWithTooltip';
import PrereqTreeDisplay, { HandledPrereq } from './PrereqTreeDisplay';
import { SemesterOfferingBadge } from './SemesterOfferingBadge';
import { getSapCourseUrl } from '../../utils/sapUtils';

interface CourseDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: RawCourseData | null;
  allCourses: RawCourseData[];
  coursesInPlanIds?: Set<string>;
  semesters?: Record<string, string[]>;
  targetCourseSemesterKey?: string;
}

export const CourseDetailModal: React.FC<CourseDetailModalProps> = ({ isOpen, onClose, course, allCourses, coursesInPlanIds, semesters, targetCourseSemesterKey }) => {
  if (!isOpen || !course) {
    return null;
  }

  const courseName = course.name || 'פרטי קורס';
  const courseId = course._id || 'N/A';
  const courseCredits = course.credits !== undefined ? course.credits : 'N/A';
  const academicPoints = course.academic_points;
  const hours = course.hours;
  const faculty = course.faculty;
  const semestersFromInfo = course.semesters || course.semester;
  const descriptionFromInfo = course.info;
  const prerequisitesText = course.prerequisites as string | undefined;
  const courseUrl = course.url;
  const sapUrl = getSapCourseUrl(courseId, course);
  const syllabus = course.syllabus;
  const studyProgram = course.study_program;
  const noCreditCourses = course.no_credit_courses;
  const lecturer = course.lecturer;
  const notes = course.notes;
  const examADate = course.exam_a;
  const examBDate = course.exam_b;
  const prereqTreeData = course.prereqTree;

  const isValidPrereqTree = (data: unknown): data is HandledPrereq => {
    if (!data) return false;
    if (typeof data === 'string') return true;
    if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>;
      if (Array.isArray(obj.or) && obj.or.every(item => isValidPrereqTree(item))) return true;
      if (Array.isArray(obj.and) && obj.and.every(item => isValidPrereqTree(item))) return true;
      if (Array.isArray(obj.list) && typeof obj.type === 'string') {
        const group = obj as unknown as PrerequisiteGroup;
        return group.list.every(item => isValidPrereqTree(item));
      }
    }
    return false;
  };

  const renderPrereqTree = (): React.ReactNode => {
    if (!prereqTreeData) return null;
    if (!isValidPrereqTree(prereqTreeData)) {
      return <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">אין מידע קדם מובנה זמין עבור קורס זה.</p>;
    }
    return (
      <div className="mt-1 pl-2">
        <PrereqTreeDisplay
          prereq={prereqTreeData}
          allCourses={allCourses}
          coursesInPlanIds={coursesInPlanIds}
          semesters={semesters}
          targetCourseSemesterKey={targetCourseSemesterKey}
        />
      </div>
    );
  };

  const renderPrereqSection = (): React.ReactNode | null => {
    if (!prereqTreeData) return null;
    const treeContent = renderPrereqTree();
    if (!treeContent) return null;
    return (
      <div>
        <strong className="font-medium text-gray-800 dark:text-gray-100">דרישות קדם (מבנה לוגי):</strong>
        {treeContent}
      </div>
    );
  };

  const renderContent = () => {
    return (
      <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-1 border-b border-gray-100 dark:border-gray-800">
          <p className="flex items-center gap-2">
            <strong className="font-medium text-gray-800 dark:text-gray-100">מספר קורס:</strong>
            <span className="font-mono font-bold text-gray-900 dark:text-gray-100">{courseId}</span>
          </p>
          {sapUrl ? (
            <a
              href={sapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/60 dark:hover:bg-blue-800/80 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700 transition-all shadow-sm group"
              title="פתח קורס זה במערכת ה-SAP של הטכניון"
            >
              <span>קישור לסאפ (SAP)</span>
              <span className="text-[11px] group-hover:translate-x-0.5 transition-transform">↗</span>
            </a>
          ) : (
            <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">
              קישור לסאפ: לא זמין
            </span>
          )}
        </div>
        <p><strong className="font-medium text-gray-800 dark:text-gray-100">נקודות זכות:</strong> {courseCredits}</p>
        {academicPoints !== undefined && <p><strong className="font-medium text-gray-800 dark:text-gray-100">נקודות אקדמיות:</strong> {academicPoints}</p>}
        {hours && <p><strong className="font-medium text-gray-800 dark:text-gray-100">שעות:</strong> {hours}</p>}
        {faculty && <p><strong className="font-medium text-gray-800 dark:text-gray-100">פקולטה:</strong> {faculty}</p>}
        <p className="flex items-center gap-1.5"><strong className="font-medium text-gray-800 dark:text-gray-100">מתי ניתן:</strong> <SemesterOfferingBadge semesters={semestersFromInfo} /></p>
              {semestersFromInfo && (
          <p><strong className="font-medium text-gray-800 dark:text-gray-100">סמסטרים מוצעים:</strong> {semestersFromInfo.join(', ')}</p>
        )}
        
        {descriptionFromInfo && (
          <div>
            <strong className="font-medium text-gray-800 dark:text-gray-100">תיאור הקורס:</strong>
            <p className="mt-1 whitespace-pre-wrap">{descriptionFromInfo}</p>
          </div>
        )}

        {prerequisitesText && (
          <div>
            <strong className="font-medium text-gray-800 dark:text-gray-100">דרישות קדם (טקסט):</strong>
            <p className="mt-1 whitespace-pre-wrap">{prerequisitesText}</p>
          </div>
        )}

        {renderPrereqSection()}

        {syllabus && (
          <div>
            <strong className="font-medium text-gray-800 dark:text-gray-100">סילבוס:</strong>
            <p className="mt-1 whitespace-pre-wrap">{syllabus}</p>
          </div>
        )}

        {studyProgram && <p><strong className="font-medium text-gray-800 dark:text-gray-100">תוכנית לימודים:</strong> {studyProgram}</p>}
        
        {noCreditCourses && (
          <div>
            <strong className="font-medium text-gray-800 dark:text-gray-100">קורסים ללא זיכוי נוסף:</strong>
            <div className="mt-1 flex flex-wrap gap-1">
              {noCreditCourses.split(/[,\s]+/).map(id => id.trim()).filter(id => id).map((courseId, index) => (
                <PrereqCourseIdWithTooltip 
                  key={index} 
                  courseId={courseId} 
                  allCourses={allCourses} 
                />
              ))}
            </div>
          </div>
        )}
        
        {lecturer && <p><strong className="font-medium text-gray-800 dark:text-gray-100">מרצה:</strong> {lecturer}</p>}
        
        {notes && (
          <div>
            <strong className="font-medium text-gray-800 dark:text-gray-100">הערות:</strong>
            <p className="mt-1 whitespace-pre-wrap">{notes}</p>
          </div>
        )}

        {examADate && <p><strong className="font-medium text-gray-800 dark:text-gray-100">מועד א׳:</strong> {examADate}</p>}
        {examBDate && <p><strong className="font-medium text-gray-800 dark:text-gray-100">מועד ב׳:</strong> {examBDate}</p>}

        <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-1.5">
          <p className="flex items-center gap-1.5">
            <strong className="font-medium text-gray-800 dark:text-gray-100">קישור לסאפ (SAP):</strong> 
            {sapUrl ? (
              <a href={sapUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline font-semibold inline-flex items-center gap-1">
                <span>פתח בסאפ</span>
                <span className="text-xs">↗</span>
              </a>
            ) : (
              <span className="text-gray-400 dark:text-gray-500 font-medium">לא זמין</span>
            )}
          </p>
          {courseUrl && (
            <p className="flex items-center gap-1.5 text-xs text-gray-500">
              <strong className="font-medium text-gray-700 dark:text-gray-300">קישור נוסף (UG):</strong> 
              <a href={courseUrl as string} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline">
                פתח ב-UG ↗
              </a>
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title={courseName} maxWidth='max-w-lg'>
      {renderContent()}
    </BaseModal>
  );
}; 
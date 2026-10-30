import { RawCourseData } from '../types/data';

/**
 * Returns the Technion SAP portal URL for a course, or null if not available.
 * 
 * Technion SAP course URL structure:
 * https://portalex.technion.ac.il/ovv/?sap-theme=sap_belize&sap-language=HE&sap-ui-language=HE#/details/<YEAR>/<SEMESTER>/SM/<PADDED_COURSE_ID>
 */
export function getSapCourseUrl(courseId?: string | null, courseData?: RawCourseData | null): string | null {
  if (!courseId) return null;

  // Virtual courses (like bonus credits) don't have an SAP page
  if (courseId === 'bonus_credits' || courseId.startsWith('bonus_')) {
    return null;
  }

  // If a direct URL is already attached to the course, use it
  if (courseData?.url && typeof courseData.url === 'string' && courseData.url.startsWith('http')) {
    return courseData.url;
  }

  // Extract clean ID
  const cleanId = courseId.trim().replace(/^c-/, '');
  // Must be numeric (Technion courses are 4 to 8 digits)
  if (!/^\d{4,8}$/.test(cleanId)) {
    return null;
  }

  // Pad to 8 digits if needed (standard Technion SAP format)
  const paddedId = cleanId.padStart(8, '0');

  // Determine semester code: '201' for Spring, '202' for Summer, default '200' for Winter
  const sems = courseData?.semesters || courseData?.semester;
  let semCode = '200';
  if (Array.isArray(sems)) {
    if (sems.includes('אביב') && !sems.includes('חורף')) {
      semCode = '201';
    } else if (sems.includes('קיץ') && !sems.includes('חורף') && !sems.includes('אביב')) {
      semCode = '202';
    }
  }

  // Current Technion academic year (2026 for 2026-2027)
  const academicYear = '2026';

  return `https://portalex.technion.ac.il/ovv/?sap-theme=sap_belize&sap-language=HE&sap-ui-language=HE#/details/${academicYear}/${semCode}/SM/${paddedId}`;
}

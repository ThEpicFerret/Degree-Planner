import { RawCourseData } from '../types/data';

/**
 * Clean course ID string (strip 'c-' prefix, trim)
 */
export function getCleanCourseId(courseId?: string | null): string | null {
  if (!courseId) return null;
  if (courseId === 'bonus_credits' || courseId.startsWith('bonus_')) return null;
  const clean = courseId.trim().replace(/^c-/, '');
  if (!/^\d{4,8}$/.test(clean)) return null;
  return clean;
}

/**
 * Returns the reliable Technion SAP portal search catalog URL.
 * Direct links to #/details/... fail with an RFC error / blank page on SAP
 * because external users lack the student's internal composite booking keys.
 * Navigating to the SAP Search view (#/search/SM) works reliably and allows
 * instant pasting of the course number.
 */
export function getSapCourseUrl(courseId?: string | null, courseData?: RawCourseData | null): string | null {
  const cleanId = getCleanCourseId(courseId);
  if (!cleanId) return null;

  if (courseData?.url && typeof courseData.url === 'string' && courseData.url.startsWith('http')) {
    return courseData.url;
  }

  return 'https://portalex.technion.ac.il/ovv/?sap-theme=sap_belize&sap-language=HE&sap-ui-language=HE#/search/SM';
}

/**
 * Technion Undergraduate Studies Portal (Ugportal) course search URL -
 * opens the official syllabus page directly for everyone without logging in.
 */
export function getUgportalUrl(courseId?: string | null): string | null {
  const cleanId = getCleanCourseId(courseId);
  if (!cleanId) return null;
  return `https://ugportal.technion.ac.il/?s=${cleanId}`;
}

/**
 * CheeseFork Technion course exam scans and past tests URL
 */
export function getCheeseforkScansUrl(courseId?: string | null): string | null {
  const cleanId = getCleanCourseId(courseId);
  if (!cleanId) return null;
  return `https://scans.cheesefork.cf/?course=${cleanId}`;
}

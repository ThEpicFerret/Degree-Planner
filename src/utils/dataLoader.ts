import { DegreesFileStructure, RawCourseData, DegreeTemplate } from '../types/data';

export interface CatalogYearOption {
  id: string;
  label: string;
  isDefault?: boolean;
}

/**
 * Returns a robust URL for fetching public assets.
 * Handles GitHub Pages subpaths (e.g. /Degree-Planner/), custom domains,
 * localhost, relative deployments, and cases where the address bar URL lacks a trailing slash.
 */
export function getAssetUrl(relativePath: string): string {
  const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;

  if (typeof window !== 'undefined') {
    // 1. In Vite production build, assets/index-*.js is loaded from <repo-base>/assets/
    // Using import.meta.url resolves directly relative to that bundle:
    try {
      if (typeof import.meta !== 'undefined' && import.meta.url && import.meta.url.includes('/assets/')) {
        return new URL(`../${cleanPath}`, import.meta.url).href;
      }
    } catch {
      // Fall through to window.location resolution
    }

    // 2. Resolve relative to window.location pathname:
    try {
      const loc = window.location;
      let pathname = loc.pathname || '/';
      // If pathname ends with a file (e.g. index.html), strip it to the directory
      if (pathname.split('/').pop()?.includes('.')) {
        pathname = pathname.substring(0, pathname.lastIndexOf('/') + 1);
      } else if (!pathname.endsWith('/')) {
        pathname = pathname + '/';
      }
      return `${loc.origin}${pathname}${cleanPath}`;
    } catch {
      // Fall through
    }
  }

  const base = import.meta.env.BASE_URL || './';
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  return `${cleanBase}${cleanPath}`;
}

export async function fetchAvailableYears(): Promise<CatalogYearOption[]> {
  try {
    const yearsPath = getAssetUrl('data/years.json');
    const response = await fetch(yearsPath);
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        return data as CatalogYearOption[];
      }
    }
  } catch {
    // Fallback to default year
  }
  return [{ id: '2026-2027', label: 'תשפ"ז (2026-2027)', isDefault: true }];
}

export async function fetchAllCourses(year?: string): Promise<RawCourseData[]> {
  try {
    const yearSubpath = year ? getAssetUrl(`data/${year}/merged_courses.json`) : getAssetUrl('data/merged_courses.json');
    let response = await fetch(yearSubpath);
    if (!response.ok && year) {
      response = await fetch(getAssetUrl('data/merged_courses.json'));
    }
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      const coursesArray: RawCourseData[] = Object.entries(data).map(([id, courseDetails]) => ({
        _id: id,
        ...(courseDetails as Omit<RawCourseData, '_id'>),
      } as RawCourseData));
      return coursesArray;
    } else if (Array.isArray(data)) {
      return data as RawCourseData[];
    }

    console.error('[fetchAllCourses] Unexpected data structure received:', data);
    return [];
  } catch (error) {
    console.error('Failed to fetch courses:', error);
    return [];
  }
}

export async function fetchDegreeTemplates(year?: string): Promise<DegreesFileStructure> {
  try {
    const yearSubpath = year ? getAssetUrl(`data/${year}/degrees.json`) : getAssetUrl('data/degrees.json');
    let response = await fetch(yearSubpath);
    if (!response.ok && year) {
      response = await fetch(getAssetUrl('data/degrees.json'));
    }
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = (await response.json()) as DegreesFileStructure;

    const processedData: DegreesFileStructure = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const item = data[key];
        if (
          key !== 'globalRules' &&
          typeof item === 'object' &&
          item !== null &&
          'semesters' in item &&
          !Array.isArray(item)
        ) {
          const tmpl = { ...(item as DegreeTemplate), id: key };
          // Ensure "סמסטר 0" exists and is empty by default for all degree templates
          if (tmpl.semesters && typeof tmpl.semesters === 'object' && !('סמסטר 0' in tmpl.semesters)) {
            tmpl.semesters = {
              'סמסטר 0': [],
              ...tmpl.semesters,
            };
          }
          processedData[key] = tmpl;
        } else {
          processedData[key] = item;
        }
      }
    }
    return processedData;
  } catch (error) {
    console.error('Failed to fetch degree templates:', error);
    return {};
  }
}

export async function getDegreeTemplateById(degreeId: string, year?: string): Promise<DegreeTemplate | undefined> {
  const templates = await fetchDegreeTemplates(year);
  if (degreeId === 'globalRules') {
    return undefined;
  }
  const potentialTemplate = templates[degreeId];
  if (
    potentialTemplate &&
    typeof potentialTemplate === 'object' &&
    'semesters' in potentialTemplate &&
    !Array.isArray(potentialTemplate)
  ) {
    const tmpl = potentialTemplate as DegreeTemplate;
    if (tmpl.semesters && typeof tmpl.semesters === 'object' && !('סמסטר 0' in tmpl.semesters)) {
      tmpl.semesters = {
        'סמסטר 0': [],
        ...tmpl.semesters,
      };
    }
    return tmpl;
  }
  return undefined;
}

export async function getCourseById(courseId: string, year?: string): Promise<RawCourseData | undefined> {
  const courses = await fetchAllCourses(year);
  return courses.find(course => course._id === courseId);
}

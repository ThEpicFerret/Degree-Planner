import { DegreesFileStructure, RawCourseData, DegreeTemplate } from '../types/data';

export interface CatalogYearOption {
  id: string;
  label: string;
  isDefault?: boolean;
}

export async function fetchAvailableYears(): Promise<CatalogYearOption[]> {
  try {
    const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, '');
    const yearsPath = `${baseUrl}/data/years.json`.replace(/\/\//g, '/');
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
    const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, '');
    const yearSubpath = year ? `${baseUrl}/data/${year}/merged_courses.json` : `${baseUrl}/data/merged_courses.json`;
    let response = await fetch(yearSubpath.replace(/\/\//g, '/'));
    if (!response.ok && year) {
      response = await fetch(`${baseUrl}/data/merged_courses.json`.replace(/\/\//g, '/'));
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
    const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, '');
    const yearSubpath = year ? `${baseUrl}/data/${year}/degrees.json` : `${baseUrl}/data/degrees.json`;
    let response = await fetch(yearSubpath.replace(/\/\//g, '/'));
    if (!response.ok && year) {
      response = await fetch(`${baseUrl}/data/degrees.json`.replace(/\/\//g, '/'));
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
          processedData[key] = { ...(item as DegreeTemplate), id: key };
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
    return potentialTemplate as DegreeTemplate;
  }
  return undefined;
}

export async function getCourseById(courseId: string, year?: string): Promise<RawCourseData | undefined> {
  const courses = await fetchAllCourses(year);
  return courses.find(course => course._id === courseId);
}

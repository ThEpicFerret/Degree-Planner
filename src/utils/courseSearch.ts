/**
 * Normalizes text for Hebrew/English search comparisons:
 * - Lowercase
 * - Strips Hebrew niqqud
 * - Normalizes quotes (״, ") and geresh (׳, ')
 * - Trims whitespace
 */
export function normalizeSearchString(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[\u0591-\u05C7]/g, '') // Hebrew diacritics
    .replace(/[״"]/g, '"')
    .replace(/[׳']/g, "'")
    .trim();
}

/**
 * Escapes characters for safe RegExp construction.
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Determines whether a course matches a search query.
 * 
 * Supports:
 * - Course number (partial or full, with or without leading zeros)
 * - Exact substrings in course name
 * - Hyphenated segments (if name is "a b-c", matches "a", "a b", "b", "b-c", "c", "b c")
 * - Multi-word tokens
 * - Hebrew acronyms without quotes (e.g. מדח matches מד"ח, חדוא matches חדו"א)
 * - Prevents overly broad single-character matches across Hebrew text
 */
export function matchesCourseQuery(
  rawQuery: string,
  courseId: string,
  courseName: string
): boolean {
  if (!rawQuery) return false;
  const query = normalizeSearchString(rawQuery);
  if (query.length === 0) return false;

  const rawId = (courseId || '').toLowerCase().trim();
  const unpaddedId = rawId.replace(/^0+/, '');
  const unpaddedQuery = query.replace(/^0+/, '');

  // 1. Course ID matching
  if (rawId.includes(query)) return true;
  if (unpaddedQuery.length >= 2 && unpaddedId.includes(unpaddedQuery)) return true;

  // 2. Course Name matching
  const nameNorm = normalizeSearchString(courseName || '');
  if (!nameNorm) return false;

  const withHyphens = nameNorm;
  const withSpaces = nameNorm.replace(/[-_–—/]/g, ' ');

  // Direct substring matches
  if (withHyphens.includes(query)) return true;
  if (withSpaces.includes(query)) return true;

  const queryWithSpaces = query.replace(/[-_–—/]/g, ' ');
  if (withSpaces.includes(queryWithSpaces)) return true;

  // No quotes/geresh match (e.g. מדח matches מד"ח, חדוא matches חדו"א)
  const normNoQuotes = nameNorm.replace(/["']/g, '');
  const queryNoQuotes = query.replace(/["']/g, '');
  if (queryNoQuotes.length >= 2 && normNoQuotes.includes(queryNoQuotes)) return true;

  // For single-character queries: ensure boundary match so we don't match every single Hebrew word
  if (query.length === 1) {
    const escaped = escapeRegExp(query);
    const boundaryRegex = new RegExp(`(^|[\\s-_–—/.,()'\"])${escaped}`, 'i');
    return boundaryRegex.test(withHyphens);
  }

  // Multi-word token match: every token in the query must be found in the course name or ID
  const tokens = queryWithSpaces.split(/\s+/).filter(t => t.length > 0);
  if (tokens.length > 1) {
    const allMatch = tokens.every(token => withSpaces.includes(token) || rawId.includes(token));
    if (allMatch) return true;
  }

  return false;
}

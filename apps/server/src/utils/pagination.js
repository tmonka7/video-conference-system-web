const MAX_LIMIT = 100;

export function resolvePagination(query = {}, defaultLimit = 20) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(query.limit) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

/** Turns "-createdAt,name" into a Mongoose sort object. */
export function resolveSort(sort, fallback) {
  if (!sort) return fallback;
  const entries = String(sort)
    .split(',')
    .map((field) => field.trim())
    .filter(Boolean)
    .map((field) => (field.startsWith('-') ? [field.slice(1), -1] : [field, 1]));
  return entries.length ? Object.fromEntries(entries) : fallback;
}

/** Escapes user input before it is used inside a RegExp search. */
export function escapeRegex(value) {
  return String(value).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

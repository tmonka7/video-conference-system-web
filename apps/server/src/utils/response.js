/**
 * Every REST response uses one envelope, so clients branch on `success`:
 *   { success: true, data }
 *   { success: false, error: { code, message, details? } }
 */

export function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

export function created(res, data) {
  return ok(res, data, 201);
}

export function noContent(res) {
  return res.status(204).send();
}

export function pageMeta(total, page, limit) {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return { page, limit, total, totalPages, hasNext: page < totalPages };
}

export function paginated(items, total, page, limit) {
  return { items, meta: pageMeta(total, page, limit) };
}

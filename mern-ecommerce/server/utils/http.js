/**
 * HTTP helpers shared by every router.
 *
 * - asyncHandler: forwards a rejected promise to the error middleware in
 *   index.js. Express 4 does not do this itself, so without it an async route
 *   that throws leaves the request hanging or kills the process with an
 *   unhandled rejection.
 * - httpError: an Error carrying an HTTP status; the error middleware answers
 *   `{ error: message, ...extra }` with that status.
 * - pick: copies whitelisted keys only, so a request body can never write
 *   fields such as `role`, `user`, `status`, `merchant` or `_id`.
 * - parsePagination: page/limit from the query string, clamped to sane bounds.
 * - isObjectId: true for a 24-hex-digit id string, checked before querying.
 */
const asyncHandler = fn => (req, res, next) =>
  Promise.resolve()
    .then(() => fn(req, res, next))
    .catch(next);

const httpError = (status, message, extra) => {
  const error = new Error(message);
  error.status = status;
  error.expose = true;
  if (extra) error.extra = extra;
  return error;
};

const pick = (source, keys) => {
  const result = {};
  if (!source || typeof source !== 'object') return result;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
      result[key] = source[key];
    }
  }
  return result;
};

// The Oracle Database API for MongoDB rejects a skip beyond int32 with a 500,
// so the page is clamped to the last one whose skip still fits.
const MAX_SKIP = 2 ** 31 - 1;

const parsePagination = (query = {}, { defaultLimit = 10, maxLimit = 50 } = {}) => {
  const requested = Number.parseInt(query.limit, 10);
  const limit = Math.min(maxLimit, Math.max(1, Number.isFinite(requested) ? requested : defaultLimit));
  const maxPage = Math.floor(MAX_SKIP / limit) + 1;
  const page = Math.min(maxPage, Math.max(1, Number.parseInt(query.page, 10) || 1));
  return { page, limit, skip: (page - 1) * limit };
};

const isObjectId = value => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);

module.exports = { asyncHandler, httpError, pick, parsePagination, isObjectId };

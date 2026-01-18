const parsePagination = (query, options = {}) => {
  const { defaultLimit = null, maxLimit = 200 } = options;
  const limitRaw = query.limit;
  const offsetRaw = query.offset;

  let limit = defaultLimit;
  if (limitRaw !== undefined) {
    const parsed = Number(limitRaw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return { error: 'limit must be a positive integer' };
    }
    limit = Math.min(parsed, maxLimit);
  }

  let offset = 0;
  if (offsetRaw !== undefined) {
    const parsed = Number(offsetRaw);
    if (!Number.isInteger(parsed) || parsed < 0) {
      return { error: 'offset must be a non-negative integer' };
    }
    offset = parsed;
  }

  return { limit, offset };
};

module.exports = { parsePagination };

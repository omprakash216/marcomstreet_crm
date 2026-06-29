function cleanParams(params = []) {
  return params.map((value) => {
    if (value === undefined) return null;
    if (typeof value === 'number' && Number.isNaN(value)) return null;
    return value;
  });
}

function getSafePagination(query = {}, { defaultLimit = 25, maxLimit = 1000 } = {}) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const requestedLimit = Math.min(parseInt(query.limit, 10) || defaultLimit, maxLimit);
  const safeLimit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : defaultLimit;
  const safeOffset = Number.isFinite((page - 1) * safeLimit) ? (page - 1) * safeLimit : 0;

  return { page, requestedLimit, safeLimit, safeOffset };
}

module.exports = {
  cleanParams,
  getSafePagination,
};

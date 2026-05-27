export function parsePagination(query, defaults = { page: 1, pageSize: 25, maxPageSize: 100 }) {
  const page = Math.max(1, Number(query['pagination[page]'] || query.page || defaults.page));
  const pageSize = Math.min(
    defaults.maxPageSize,
    Math.max(1, Number(query['pagination[pageSize]'] || query.pageSize || defaults.pageSize)),
  );
  const offset = (page - 1) * pageSize;
  return { page, pageSize, limit: pageSize, offset };
}

export function paginationMeta(page, pageSize, total) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return {
    pagination: {
      page,
      pageSize,
      pageCount,
      total,
    },
  };
}

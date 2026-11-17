export interface PaginationEnvelope<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export function pagination(
  page?: string | number,
  limit?: string | number,
): { page: number; limit: number; skip: number } {
  const parsedPage = Number(page);
  const parsedLimit = Number(limit);
  const currentPage =
    Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const currentLimit =
    Number.isInteger(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, 200)
      : 50;
  return {
    page: currentPage,
    limit: currentLimit,
    skip: (currentPage - 1) * currentLimit,
  };
}

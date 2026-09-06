/** Shared pagination constants and helpers for EventLink list queries. */

export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
export const MAX_PAGE_SIZE = 100;

export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export type PaginationParams = {
  page?: number;
  pageSize?: number;
};

export type SortDir = "asc" | "desc";

export type PaginatedResult<T> = {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

export function clampPageSize(pageSize?: number): number {
  const n = Math.floor(Number(pageSize) || DEFAULT_PAGE_SIZE);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, n);
}

export function clampPage(page?: number): number {
  const n = Math.floor(Number(page) || 1);
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

/** Convert 1-based page to inclusive Supabase `.range(from, to)` bounds. */
export function pageToRange(page?: number, pageSize?: number): { from: number; to: number; page: number; pageSize: number } {
  const safePage = clampPage(page);
  const safeSize = clampPageSize(pageSize);
  const from = (safePage - 1) * safeSize;
  const to = from + safeSize - 1;
  return { from, to, page: safePage, pageSize: safeSize };
}

export function emptyPage<T>(page = 1, pageSize = DEFAULT_PAGE_SIZE): PaginatedResult<T> {
  return {
    rows: [],
    total: 0,
    page: clampPage(page),
    pageSize: clampPageSize(pageSize),
    hasMore: false,
  };
}

export function buildPaginatedResult<T>(
  rows: T[],
  total: number | null | undefined,
  page: number,
  pageSize: number,
): PaginatedResult<T> {
  const safePage = clampPage(page);
  const safeSize = clampPageSize(pageSize);
  const safeTotal = Math.max(0, Number(total ?? rows.length));
  return {
    rows,
    total: safeTotal,
    page: safePage,
    pageSize: safeSize,
    hasMore: safePage * safeSize < safeTotal,
  };
}

export function showingLabel(page: number, pageSize: number, total: number): string {
  if (total <= 0) return "Showing 0 of 0";
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return `Showing ${from}–${to} of ${total}`;
}

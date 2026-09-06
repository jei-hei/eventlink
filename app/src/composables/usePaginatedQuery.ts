import { computed, ref, shallowRef, watch, type Ref } from "vue";
import {
  DEFAULT_PAGE_SIZE,
  buildPaginatedResult,
  clampPage,
  clampPageSize,
  emptyPage,
  showingLabel,
  type PaginatedResult,
  type PaginationParams,
} from "@/types/pagination";
import { useDebouncedRef } from "@/composables/useDebounce";
import { toUserFacingError } from "@/utils/userFacingError";

export type PaginatedFetcher<T, F> = (
  params: PaginationParams & { search?: string } & F,
) => Promise<PaginatedResult<T>>;

type UsePaginatedQueryOptions<T, F extends Record<string, unknown>> = {
  fetcher: PaginatedFetcher<T, F>;
  filters?: Ref<F> | (() => F);
  search?: Ref<string>;
  searchDebounceMs?: number;
  initialPageSize?: number;
  immediate?: boolean;
};

/**
 * Reusable server-side pagination state for list UIs.
 * Filters/search reset to page 1; fetcher must apply them in Supabase.
 */
export function usePaginatedQuery<T, F extends Record<string, unknown> = Record<string, never>>(
  options: UsePaginatedQueryOptions<T, F>,
) {
  const page = ref(1);
  const pageSize = ref(clampPageSize(options.initialPageSize ?? DEFAULT_PAGE_SIZE));
  const loading = ref(false);
  const error = ref<string | null>(null);
  const result = shallowRef<PaginatedResult<T>>(emptyPage<T>());
  const requestId = ref(0);

  const searchSource = options.search ?? ref("");
  const debouncedSearch = useDebouncedRef(searchSource, options.searchDebounceMs ?? 350);

  const filtersRef = computed(() => {
    if (!options.filters) return {} as F;
    return typeof options.filters === "function" ? options.filters() : options.filters.value;
  });

  const rows = computed(() => result.value.rows);
  const total = computed(() => result.value.total);
  const hasMore = computed(() => result.value.hasMore);
  const isEmpty = computed(() => !loading.value && !error.value && result.value.total === 0);
  const rangeLabel = computed(() =>
    showingLabel(result.value.page, result.value.pageSize, result.value.total),
  );

  async function refresh() {
    const id = ++requestId.value;
    loading.value = true;
    error.value = null;
    try {
      const data = await options.fetcher({
        page: page.value,
        pageSize: pageSize.value,
        search: debouncedSearch.value?.trim() || undefined,
        ...(filtersRef.value as F),
      });
      if (id !== requestId.value) return;
      result.value = buildPaginatedResult(data.rows, data.total, data.page, data.pageSize);
      page.value = data.page;
      pageSize.value = data.pageSize;
    } catch (e) {
      if (id !== requestId.value) return;
      error.value = toUserFacingError(e, "Could not load results.");
      result.value = emptyPage<T>(page.value, pageSize.value);
    } finally {
      if (id === requestId.value) loading.value = false;
    }
  }

  function setPage(next: number) {
    const safe = clampPage(next);
    if (safe === page.value) {
      void refresh();
      return;
    }
    page.value = safe;
  }

  function setPageSize(next: number) {
    pageSize.value = clampPageSize(next);
    page.value = 1;
  }

  function nextPage() {
    if (hasMore.value) page.value = clampPage(page.value + 1);
  }

  function prevPage() {
    if (page.value > 1) page.value = clampPage(page.value - 1);
  }

  watch([page, pageSize], () => {
    void refresh();
  }, { immediate: options.immediate !== false });

  watch([debouncedSearch, filtersRef], () => {
    if (page.value !== 1) {
      page.value = 1;
    } else {
      void refresh();
    }
  }, { deep: true });

  return {
    page,
    pageSize,
    loading,
    error,
    rows,
    total,
    hasMore,
    isEmpty,
    rangeLabel,
    result,
    refresh,
    setPage,
    setPageSize,
    nextPage,
    prevPage,
  };
}

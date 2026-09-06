import { getSupabase } from "@/lib/supabase";
import { APP_ROLE_LABEL, LEGACY_STUDENT_ROLE, type AppRole } from "@/types/appRole";
import {
  buildPaginatedResult,
  emptyPage,
  pageToRange,
  type PaginatedResult,
  type PaginationParams,
} from "@/types/pagination";

export type AdminPortalUserRow = {
  user_id: string;
  app_role: AppRole | typeof LEGACY_STUDENT_ROLE;
  display_name: string;
  email: string;
  student_id: string;
  college: string;
  program: string;
};

const ROLE_LABEL: Record<AppRole | typeof LEGACY_STUDENT_ROLE, string> = {
  [LEGACY_STUDENT_ROLE]: "Student (legacy)",
  ...APP_ROLE_LABEL,
};

export function adminRoleLabel(role: string): string {
  return ROLE_LABEL[role as AppRole | typeof LEGACY_STUDENT_ROLE] ?? role;
}

/** @deprecated Prefer fetchAdminPortalUsersPage for list UIs. */
export async function fetchAdminPortalUsers(): Promise<AdminPortalUserRow[]> {
  const page = await fetchAdminPortalUsersPage({ page: 1, pageSize: 100 });
  return page.rows;
}

export type AdminUsersPageFilters = PaginationParams & {
  search?: string;
  role?: AppRole | null;
};

export async function fetchAdminPortalUsersPage(
  params: AdminUsersPageFilters = {},
): Promise<PaginatedResult<AdminPortalUserRow>> {
  const { page, pageSize, from } = pageToRange(params.page, params.pageSize);
  const supabase = getSupabase();

  const { data, error } = await supabase.rpc("admin_list_portal_users_page", {
    p_search: params.search?.trim() || null,
    p_role: params.role ?? null,
    p_limit: pageSize,
    p_offset: from,
  });

  if (error) {
    // Fallback for databases that have not applied the paginated RPC yet.
    const legacy = await supabase.rpc("admin_list_portal_users");
    if (legacy.error) throw error;
    let rows = (legacy.data ?? []) as AdminPortalUserRow[];
    const q = params.search?.trim().toLowerCase();
    if (params.role) rows = rows.filter((r) => r.app_role === params.role);
    if (q) {
      rows = rows.filter(
        (r) =>
          r.display_name?.toLowerCase().includes(q) ||
          r.email?.toLowerCase().includes(q) ||
          r.user_id.toLowerCase().includes(q) ||
          String(r.app_role).toLowerCase().includes(q),
      );
    }
    const total = rows.length;
    const sliced = rows.slice(from, from + pageSize);
    return buildPaginatedResult(sliced, total, page, pageSize);
  }

  const rows = (data ?? []) as Array<AdminPortalUserRow & { total_count?: number | string }>;
  const total = rows.length ? Number(rows[0]?.total_count ?? rows.length) : 0;
  return buildPaginatedResult(
    rows.map(({ total_count: _t, ...rest }) => rest),
    total,
    page,
    pageSize,
  );
}

export async function countAdminPortalUsers(): Promise<number> {
  const page = await fetchAdminPortalUsersPage({ page: 1, pageSize: 1 });
  return page.total;
}

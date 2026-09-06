import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  countMyUnreadNotifications,
  fetchMyNotificationsPage,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationCategory,
} from "@/services/notificationsDb";
import { isSupabaseConfigured } from "@/lib/supabase";
import { DEFAULT_PAGE_SIZE } from "@/types/pagination";

export interface AppNotification {
  id: string;
  title: string;
  body?: string;
  category: "approval" | "system" | "calendar" | "security" | "other";
  read: boolean;
  createdAt: string;
  href?: string;
}

export const useNotificationsStore = defineStore("notifications", () => {
  const items = ref<AppNotification[]>([]);
  const hydrated = ref(false);
  const loadingMore = ref(false);
  const page = ref(1);
  const pageSize = ref(DEFAULT_PAGE_SIZE);
  const total = ref(0);
  const unreadCount = ref(0);

  const hasMore = computed(() => items.value.length < total.value);

  function mapRows(
    rows: Array<{
      id: string;
      title: string;
      body: string | null;
      category: NotificationCategory | null;
      read_at: string | null;
      created_at: string;
    }>,
  ): AppNotification[] {
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body ?? undefined,
      category: (r.category ?? "other") as NotificationCategory,
      read: !!r.read_at,
      createdAt: r.created_at,
    }));
  }

  async function hydrate(force = false) {
    if (!isSupabaseConfigured) return;
    if (hydrated.value && !force) return;
    page.value = 1;
    const [list, unread] = await Promise.all([
      fetchMyNotificationsPage({ page: 1, pageSize: pageSize.value }),
      countMyUnreadNotifications().catch(() => 0),
    ]);
    items.value = mapRows(list.rows);
    total.value = list.total;
    unreadCount.value = unread;
    hydrated.value = true;
  }

  async function loadMore() {
    if (!isSupabaseConfigured || loadingMore.value || !hasMore.value) return;
    loadingMore.value = true;
    try {
      const next = page.value + 1;
      const list = await fetchMyNotificationsPage({ page: next, pageSize: pageSize.value });
      const existing = new Set(items.value.map((n) => n.id));
      const appended = mapRows(list.rows).filter((n) => !existing.has(n.id));
      items.value = [...items.value, ...appended];
      page.value = next;
      total.value = list.total;
    } finally {
      loadingMore.value = false;
    }
  }

  function markRead(id: string) {
    const wasUnread = items.value.some((n) => n.id === id && !n.read);
    items.value = items.value.map((n) => (n.id === id ? { ...n, read: true } : n));
    if (wasUnread) unreadCount.value = Math.max(0, unreadCount.value - 1);
    if (isSupabaseConfigured) {
      void markNotificationRead(id).catch(() => undefined);
    }
  }

  function markAllRead() {
    items.value = items.value.map((n) => ({ ...n, read: true }));
    unreadCount.value = 0;
    if (isSupabaseConfigured) {
      void markAllNotificationsRead().catch(() => undefined);
    }
  }

  function push(n: Omit<AppNotification, "id" | "read" | "createdAt"> & { id?: string }) {
    const id = n.id ?? `n-${Date.now()}`;
    items.value = [
      {
        ...n,
        id,
        read: false,
        createdAt: new Date().toISOString(),
      },
      ...items.value,
    ];
    unreadCount.value += 1;
    total.value += 1;
  }

  function clear() {
    items.value = [];
    hydrated.value = false;
    page.value = 1;
    total.value = 0;
    unreadCount.value = 0;
  }

  return {
    items,
    unreadCount,
    hydrated,
    loadingMore,
    hasMore,
    hydrate,
    loadMore,
    markRead,
    markAllRead,
    push,
    clear,
  };
});

import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  fetchMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationCategory,
} from "@/services/notificationsDb";
import { isSupabaseConfigured } from "@/lib/supabase";

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

  const unreadCount = computed(() => items.value.filter((n) => !n.read).length);

  async function hydrate(force = false) {
    if (!isSupabaseConfigured) return;
    if (hydrated.value && !force) return;
    const rows = await fetchMyNotifications(120);
    items.value = rows.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body ?? undefined,
      category: (r.category ?? "other") as NotificationCategory,
      read: !!r.read_at,
      createdAt: r.created_at,
    }));
    hydrated.value = true;
  }

  function markRead(id: string) {
    items.value = items.value.map((n) => (n.id === id ? { ...n, read: true } : n));
    if (isSupabaseConfigured) {
      void markNotificationRead(id).catch(() => undefined);
    }
  }

  function markAllRead() {
    items.value = items.value.map((n) => ({ ...n, read: true }));
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
  }

  function clear() {
    items.value = [];
    hydrated.value = false;
  }

  return { items, unreadCount, hydrated, hydrate, markRead, markAllRead, push, clear };
});

import { defineStore } from "pinia";
import { computed, ref } from "vue";

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
  const items = ref<AppNotification[]>([
    {
      id: "1",
      title: "Welcome to EventLink",
      body: "Use the bell for approvals, calendar updates, and system notices.",
      category: "system",
      read: false,
      createdAt: new Date().toISOString(),
    },
  ]);

  const unreadCount = computed(() => items.value.filter((n) => !n.read).length);

  function markRead(id: string) {
    items.value = items.value.map((n) => (n.id === id ? { ...n, read: true } : n));
  }

  function markAllRead() {
    items.value = items.value.map((n) => ({ ...n, read: true }));
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

  return { items, unreadCount, markRead, markAllRead, push };
});

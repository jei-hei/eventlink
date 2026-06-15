<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { storeToRefs } from "pinia";
import { Bell, CheckCheck } from "lucide-vue-next";
import { useNotificationsStore } from "@/stores/notifications";
import { useClickOutside } from "@/composables/useClickOutside";

const store = useNotificationsStore();
const { items, unreadCount } = storeToRefs(store);
const open = ref(false);
const root = ref<HTMLElement | null>(null);

useClickOutside(root, () => {
  open.value = false;
});

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") open.value = false;
}

onMounted(() => window.addEventListener("keydown", onKey));
onUnmounted(() => window.removeEventListener("keydown", onKey));

const grouped = computed(() => {
  const buckets: Record<string, typeof items.value> = {
    approval: [],
    calendar: [],
    security: [],
    system: [],
    other: [],
  };
  for (const n of items.value) {
    const k = n.category in buckets ? n.category : "other";
    buckets[k]!.push(n);
  }
  return buckets;
});

function fmt(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function openNotification(n: (typeof items.value)[number]) {
  store.markRead(n.id);
  if (n.href) {
    window.location.assign(n.href);
  }
}
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="relative rounded-lg p-2 text-white transition hover:bg-white/15"
      :aria-expanded="open"
      aria-haspopup="true"
      @click.stop="open = !open"
    >
      <Bell class="h-5 w-5" />
      <span
        v-if="unreadCount > 0"
        class="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-0.5 text-[10px] font-bold text-emerald-950"
      >
        {{ unreadCount > 9 ? "9+" : unreadCount }}
      </span>
    </button>

    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 translate-y-1 scale-[0.98]"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-1"
    >
      <div
        v-if="open"
        class="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-xl ring-1 ring-slate-900/[0.04]"
        role="menu"
      >
        <div class="flex items-center justify-between border-b border-slate-100 px-3 py-2">
          <p class="text-sm font-semibold text-slate-900">Notifications</p>
          <button
            type="button"
            class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
            @click="store.markAllRead()"
          >
            <CheckCheck class="h-3.5 w-3.5" />
            Mark all read
          </button>
        </div>

        <div class="max-h-80 overflow-y-auto">
          <template v-if="!items.length">
            <div class="px-4 py-8 text-center text-sm text-slate-600">You are all caught up.</div>
          </template>
          <template v-else>
            <div v-for="(list, key) in grouped" :key="key">
              <p v-if="list.length" class="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {{ key }}
              </p>
              <button
                v-for="n in list"
                :key="n.id"
                type="button"
                class="flex w-full gap-2 border-t border-slate-50 px-3 py-2.5 text-left transition hover:bg-slate-50"
                :class="n.read ? 'opacity-70' : 'bg-emerald-50/40'"
                @click="openNotification(n)"
              >
                <span class="mt-1 h-2 w-2 shrink-0 rounded-full" :class="n.read ? 'bg-slate-300' : 'bg-emerald-500'" />
                <span class="min-w-0 flex-1">
                  <span class="block text-sm font-medium text-slate-900">{{ n.title }}</span>
                  <span v-if="n.body" class="mt-0.5 line-clamp-2 text-xs text-slate-600">{{ n.body }}</span>
                  <span class="mt-1 block text-[10px] font-medium text-slate-400">{{ fmt(n.createdAt) }}</span>
                  <span
                    v-if="n.category === 'security'"
                    class="mt-1 inline-block rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700"
                  >
                    This wasn't me
                  </span>
                </span>
              </button>
            </div>
          </template>
        </div>
      </div>
    </Transition>
  </div>
</template>

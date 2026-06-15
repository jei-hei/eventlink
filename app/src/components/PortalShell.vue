<script setup lang="ts">
import { computed } from "vue";
import { Menu, User } from "lucide-vue-next";
import { useProfileStore } from "@/stores/profile";
import { useAuthStore } from "@/stores/auth";
import NotificationDropdown from "@/components/portal/NotificationDropdown.vue";

const props = defineProps<{
  displayName?: string;
  roleTitle?: string;
  email?: string;
  department?: string;
}>();

const emit = defineEmits<{
  "open-sidebar": [];
}>();

const profile = useProfileStore();
const auth = useAuthStore();

const headerName = computed(() => {
  const p = profile.displayName?.trim();
  if (p && p !== "Guest") return p;
  const fromAuth = auth.displayName?.trim();
  if (fromAuth) return fromAuth;
  const mail = auth.email?.trim();
  if (mail) {
    const local = mail.split("@")[0];
    return local && local.length > 0 ? local : mail;
  }
  return props.displayName?.trim() || p || "User";
});

const headerRole = computed(
  () => profile.roleLabel?.trim() || props.roleTitle?.trim() || "",
);
</script>

<template>
  <div class="portal-root portal-app-shell">
    <slot name="sidebar" />

    <div class="portal-shell">
      <header class="portal-topbar">
        <div class="flex w-full min-w-0 items-center gap-2" :class="$slots['header-extra'] ? 'justify-between' : ''">
          <div class="flex min-w-0 flex-1 items-center gap-2">
            <button
              type="button"
              class="portal-topbar-btn shrink-0"
              aria-label="Open sidebar"
              @click.stop="emit('open-sidebar')"
            >
              <Menu :size="22" stroke-width="2" />
            </button>

            <div class="flex min-w-0 flex-1 items-center justify-between gap-2 sm:gap-3">
              <div
                class="flex max-w-[min(100%,15rem)] min-w-0 shrink-0 items-center gap-2 text-white sm:max-w-[18rem]"
                aria-label="Signed in user"
              >
                <User :size="18" stroke-width="2" class="shrink-0 text-white/90" aria-hidden="true" />
                <div class="min-w-0 text-left">
                  <p class="truncate text-sm font-semibold text-white">{{ headerName }}</p>
                  <p v-if="headerRole" class="truncate text-[11px] font-medium text-emerald-100/95 sm:text-xs">
                    {{ headerRole }}
                  </p>
                </div>
              </div>

              <NotificationDropdown />
            </div>
          </div>

          <div v-if="$slots['header-extra']" class="shrink-0">
            <slot name="header-extra" />
          </div>
        </div>
      </header>

      <main class="portal-main-scroll">
        <slot />
      </main>
    </div>
  </div>
</template>

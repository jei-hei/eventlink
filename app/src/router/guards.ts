import type { RouteLocationNormalized, Router } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { PUBLIC_EVENTS_PATH, ROLE_HOME_PATH, type AppRole } from "@/types/appRole";

const PUBLIC_NAMES = new Set(["login", "forgot-password", "reset-password", "public-events"]);

function allowedRolesFor(to: RouteLocationNormalized): AppRole[] | undefined {
  for (let i = to.matched.length - 1; i >= 0; i--) {
    const roles = to.matched[i]?.meta.allowedRoles as AppRole[] | undefined;
    if (roles?.length) return roles;
  }
  return undefined;
}

export function installRouterGuards(router: Router) {
  router.beforeEach(async (to) => {
    const auth = useAuthStore();
    await auth.whenReady();

    if (PUBLIC_NAMES.has(String(to.name ?? ""))) {
      if (auth.isAuthenticated && to.name === "login") {
        return auth.homePath;
      }
      return true;
    }

    if (!auth.isAuthenticated) {
      return {
        name: "login",
        query: {
          redirect: to.fullPath,
          ...(to.query.reason === "inactivity" ? { reason: "inactivity" } : {}),
        },
      };
    }

    if (!auth.appRole) {
      return PUBLIC_EVENTS_PATH;
    }

    const allowed = allowedRolesFor(to);
    if (allowed?.length && auth.appRole && !allowed.includes(auth.appRole)) {
      return auth.homePath;
    }

    return true;
  });

  router.afterEach((to) => {
    if (typeof window === "undefined") return;
    const name = String(to.name ?? "");
    if (PUBLIC_NAMES.has(name)) return;
    const path = `${window.location.origin}/`;
    if (window.location.href.split("?")[0] !== path) {
      window.history.replaceState(window.history.state, "", "/");
    }
  });
}

export function roleHome(role: AppRole): string {
  return ROLE_HOME_PATH[role] ?? "/login";
}

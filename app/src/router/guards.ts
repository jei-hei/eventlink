import type { RouteLocationNormalized, Router } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { ROLE_HOME_PATH, type AppRole } from "@/types/appRole";

const PUBLIC_NAMES = new Set(["login", "signup", "forgot-password", "student-events"]);

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
      if (auth.isAuthenticated && (to.name === "login" || to.name === "signup")) {
        return auth.homePath;
      }
      return true;
    }

    if (!auth.isAuthenticated) {
      return { name: "login", query: { redirect: to.fullPath } };
    }

    const allowed = allowedRolesFor(to);
    if (allowed?.length && auth.appRole && !allowed.includes(auth.appRole)) {
      return auth.homePath;
    }

    return true;
  });
}

export function roleHome(role: AppRole): string {
  return ROLE_HOME_PATH[role];
}

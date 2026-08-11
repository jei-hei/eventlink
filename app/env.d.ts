/// <reference types="vite/client" />

export {};

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "vue-router" {
  interface RouteMeta {
    portalRole?: import("@/types/portalProfile").PortalRoleKey;
    profileStandalone?: boolean;
    allowedRoles?: import("@/types/appRole").AppRole[];
  }
}

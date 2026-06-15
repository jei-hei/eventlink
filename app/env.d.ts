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
    portalRole?:
      | "student"
      | "student-officer"
      | "ssc"
      | "adviser"
      | "dean"
      | "osas"
      | "eo"
      | "gso"
      | "admin";
    profileStandalone?: boolean;
    allowedRoles?: import("@/types/appRole").AppRole[];
  }
}

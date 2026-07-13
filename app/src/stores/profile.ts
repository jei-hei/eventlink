import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { getProfileDefaults } from "@/config/portalProfileDefaults";
import type { ActivityStatModel, PortalRoleKey } from "@/types/portalProfile";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { fetchMyProfile, updateMyProfile } from "@/services/profilesDb";
import { fetchProfileActivityStats } from "@/services/profileActivityDb";
import { useAuthStore } from "./auth";
import { portalRoleToAppRole } from "@/types/appRole";

const OFFICE_EXTRAS_PREFIX = "eventlink_profile_office";

type OfficeExtras = {
  department: string;
  office: string;
  position: string;
};

function officeExtrasKey(userId: string) {
  return `${OFFICE_EXTRAS_PREFIX}_${userId}`;
}

function readOfficeExtras(userId: string): OfficeExtras | null {
  try {
    const raw = localStorage.getItem(officeExtrasKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as OfficeExtras;
  } catch {
    return null;
  }
}

function writeOfficeExtras(userId: string, extras: OfficeExtras) {
  localStorage.setItem(officeExtrasKey(userId), JSON.stringify(extras));
}

export interface ProfileState {
  displayName: string;
  email: string;
  role: string;
}

export const useProfileStore = defineStore("profile", () => {
  const displayName = ref("Guest");
  const email = ref("");
  const role = ref("");

  const portalRole = ref<PortalRoleKey>("student");
  const roleLabel = ref("");
  const roleDescription = ref("");
  const studentOrEmployeeId = ref("");
  const phone = ref("");
  const course = ref("");
  const program = ref("");
  const yearLevel = ref("");
  const organization = ref("");
  const department = ref("");
  const office = ref("");
  const position = ref("");
  const memberSince = ref("");
  const lastLogin = ref("");
  const isOnline = ref(true);
  const avatarDataUrl = ref<string | null>(null);
  const activityStats = ref<ActivityStatModel[]>([]);
  const loadError = ref<string | null>(null);

  const summary = computed<ProfileState>(() => ({
    displayName: displayName.value,
    email: email.value,
    role: role.value,
  }));

  function applyDefaults(d: ReturnType<typeof getProfileDefaults>) {
    portalRole.value = d.portalRole;
    roleLabel.value = d.roleLabel;
    roleDescription.value = d.roleDescription;
    studentOrEmployeeId.value = d.studentOrEmployeeId;
    phone.value = d.phone;
    course.value = d.course;
    program.value = d.program;
    yearLevel.value = d.yearLevel;
    organization.value = d.organization;
    department.value = d.department;
    office.value = d.office;
    position.value = d.position;
    memberSince.value = d.memberSince;
    lastLogin.value = d.lastLogin;
    isOnline.value = d.isOnline;
    activityStats.value = d.activityStats.map((x) => ({ ...x }));
  }

  function applyServerProfile(
    row: NonNullable<Awaited<ReturnType<typeof fetchMyProfile>>>,
    routeRole: PortalRoleKey,
  ) {
    const d = getProfileDefaults(routeRole);
    applyDefaults(d);

    displayName.value = row.display_name || authDisplayNameFallback();
    email.value = row.email ?? useAuthStore().email ?? "";
    phone.value = row.phone ?? d.phone;
    studentOrEmployeeId.value = row.student_id ?? d.studentOrEmployeeId;
    memberSince.value = row.created_at ?? d.memberSince;
    lastLogin.value = row.updated_at ?? d.lastLogin;

    const registry = row.students;
    const collegeName = row.colleges?.name ?? registry?.course ?? "";
    course.value = collegeName || d.course;
    program.value = registry?.program ?? d.program;
    yearLevel.value = registry?.year_level ?? d.yearLevel;
    organization.value = row.organizations?.name ?? d.organization;

    const extras = readOfficeExtras(row.id);
    if (extras) {
      department.value = extras.department;
      office.value = extras.office;
      position.value = extras.position;
    }

    if (useAuthStore().role) {
      role.value = useAuthStore().role!;
    } else {
      role.value = d.roleLabel;
    }
  }

  function authDisplayNameFallback() {
    const auth = useAuthStore();
    return auth.displayName ?? "Guest";
  }

  /** Load profile for the portal role; fetches Supabase when configured. */
  async function ensureHydrated(routeRole: PortalRoleKey) {
    const auth = useAuthStore();
    const d = getProfileDefaults(routeRole);
    loadError.value = null;

    if (isSupabaseConfigured && auth.userId && !auth.useMock) {
      try {
        const row = await fetchMyProfile(auth.userId);
        if (row) {
          applyServerProfile(row, routeRole);
          try {
            activityStats.value = await fetchProfileActivityStats(portalRoleToAppRole(routeRole), auth.userId);
          } catch {
            // keep defaults if stats query fails
          }
          return;
        }
        loadError.value =
          "Profile could not be created. Run migration 20260529300000_ensure_my_profile.sql in Supabase, then refresh.";
      } catch (e) {
        loadError.value = e instanceof Error ? e.message : "Could not load profile.";
      }
    }

    applyDefaults(d);

    if (auth.displayName) {
      displayName.value = auth.displayName;
    } else if (displayName.value === "Guest") {
      displayName.value = "Juan Dela Cruz";
    }

    if (auth.email) {
      email.value = auth.email;
    } else if (!email.value) {
      email.value = "juan.delacruz@isu.edu.ph";
    }

    if (auth.role) {
      role.value = auth.role;
    } else {
      role.value = d.roleLabel;
    }
  }

  async function persistPersonal(
    partial: {
      displayName?: string;
      email?: string;
      phone?: string;
      studentOrEmployeeId?: string;
      course?: string;
      program?: string;
      yearLevel?: string;
      organization?: string;
      department?: string;
      office?: string;
      position?: string;
    },
    routeRole: PortalRoleKey,
  ): Promise<void> {
    const auth = useAuthStore();
    const allowEmailEdit = routeRole !== "student";
    const emailToPersist = allowEmailEdit ? partial.email : undefined;

    if (isSupabaseConfigured && auth.userId && !auth.useMock) {
      const emailChanged =
        emailToPersist !== undefined &&
        emailToPersist.trim() !== (email.value || "").trim();

      await updateMyProfile(auth.userId, {
        displayName: partial.displayName,
        phone: partial.phone,
        email: emailToPersist,
      });

      if (emailChanged && emailToPersist?.trim()) {
        const { error } = await getSupabase().auth.updateUser({ email: emailToPersist.trim() });
        if (error) {
          throw new Error(
            `Profile saved, but login email was not updated: ${error.message}. Use Change password / Supabase email change if needed.`,
          );
        }
        auth.email = emailToPersist.trim();
      }

      if (partial.displayName !== undefined) {
        auth.displayName = partial.displayName;
      }

      if (
        partial.department !== undefined ||
        partial.office !== undefined ||
        partial.position !== undefined
      ) {
        writeOfficeExtras(auth.userId, {
          department: partial.department ?? department.value,
          office: partial.office ?? office.value,
          position: partial.position ?? position.value,
        });
      }

      patchPersonal({
        ...partial,
        email: emailToPersist,
      });
      await ensureHydrated(routeRole);
      return;
    }

    patchPersonal({
      ...partial,
      email: emailToPersist,
    });
    touchLogin();
  }

  function setFromAuth(name: string, mail: string, r: string) {
    displayName.value = name;
    email.value = mail;
    role.value = r;
  }

  function patchPersonal(partial: {
    displayName?: string;
    email?: string;
    phone?: string;
    studentOrEmployeeId?: string;
    course?: string;
    program?: string;
    yearLevel?: string;
    organization?: string;
    department?: string;
    office?: string;
    position?: string;
  }) {
    if (partial.displayName !== undefined) displayName.value = partial.displayName;
    if (partial.email !== undefined) email.value = partial.email;
    if (partial.phone !== undefined) phone.value = partial.phone;
    if (partial.studentOrEmployeeId !== undefined) studentOrEmployeeId.value = partial.studentOrEmployeeId;
    if (partial.course !== undefined) course.value = partial.course;
    if (partial.program !== undefined) program.value = partial.program;
    if (partial.yearLevel !== undefined) yearLevel.value = partial.yearLevel;
    if (partial.organization !== undefined) organization.value = partial.organization;
    if (partial.department !== undefined) department.value = partial.department;
    if (partial.office !== undefined) office.value = partial.office;
    if (partial.position !== undefined) position.value = partial.position;
  }

  function setAvatarDataUrl(url: string | null) {
    avatarDataUrl.value = url;
  }

  function touchLogin() {
    lastLogin.value = new Date().toISOString();
  }

  function clear() {
    displayName.value = "Guest";
    email.value = "";
    role.value = "";
    avatarDataUrl.value = null;
    applyDefaults(getProfileDefaults("student"));
  }

  return {
    displayName,
    email,
    role,
    summary,
    portalRole,
    roleLabel,
    roleDescription,
    studentOrEmployeeId,
    phone,
    course,
    program,
    yearLevel,
    organization,
    department,
    office,
    position,
    memberSince,
    lastLogin,
    isOnline,
    avatarDataUrl,
    activityStats,
    loadError,
    setFromAuth,
    ensureHydrated,
    persistPersonal,
    patchPersonal,
    setAvatarDataUrl,
    touchLogin,
    clear,
  };
});

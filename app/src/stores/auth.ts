import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { ROLE_HOME_PATH, type AppRole } from "@/types/appRole";

export function formatAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes("email not confirmed")) {
    return "Your email is not confirmed yet. Open the confirmation link Supabase sent you, then sign in again.";
  }
  if (lower.includes("invalid login credentials")) {
    return "Invalid email or password. If you just registered, confirm your email first.";
  }
  return msg;
}

export const useAuthStore = defineStore("auth", () => {
  const DEFAULT_INACTIVITY_LOGOUT_MS = 10 * 60 * 1000;
  const EXTENDED_INACTIVITY_LOGOUT_MS = 5 * 60 * 60 * 1000;
  const ACTIVITY_EVENTS = ["pointerdown", "keydown", "mousemove", "scroll", "touchstart"] as const;
  const EXTENDED_SESSION_ROLES = new Set<AppRole>(["eo", "gso", "osas"]);

  const ready = ref(false);
  const userId = ref<string | null>(null);
  const email = ref<string | null>(null);
  const displayName = ref<string | null>(null);
  const appRole = ref<AppRole | null>(null);
  const useMock = ref(!isSupabaseConfigured);
  const stayOnlineEnabled = ref(false);

  const isAuthenticated = computed(() => !!email.value && (useMock.value || !!userId.value));
  const canUseExtendedSession = computed(
    () => !!appRole.value && EXTENDED_SESSION_ROLES.has(appRole.value),
  );
  const inactivityLogoutMs = computed(() =>
    canUseExtendedSession.value && stayOnlineEnabled.value
      ? EXTENDED_INACTIVITY_LOGOUT_MS
      : DEFAULT_INACTIVITY_LOGOUT_MS,
  );

  const homePath = computed(() => {
    if (appRole.value) return ROLE_HOME_PATH[appRole.value];
    return "/student";
  });

  let readyResolve: (() => void) | null = null;
  const readyPromise = new Promise<void>((resolve) => {
    readyResolve = resolve;
  });
  let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  let inactivityListenersBound = false;

  function sessionPreferenceKey() {
    if (!userId.value || !appRole.value) return null;
    return `eventlink:stay-online:${userId.value}:${appRole.value}`;
  }

  function loadSessionPreference() {
    if (typeof window === "undefined") return;
    if (!canUseExtendedSession.value) {
      stayOnlineEnabled.value = false;
      return;
    }
    const key = sessionPreferenceKey();
    if (!key) {
      stayOnlineEnabled.value = false;
      return;
    }
    stayOnlineEnabled.value = window.localStorage.getItem(key) === "1";
  }

  function persistSessionPreference() {
    if (typeof window === "undefined") return;
    const key = sessionPreferenceKey();
    if (!key) return;
    if (!canUseExtendedSession.value) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, stayOnlineEnabled.value ? "1" : "0");
  }

  function clearInactivityTimer() {
    if (inactivityTimer) {
      clearTimeout(inactivityTimer);
      inactivityTimer = null;
    }
  }

  async function signOutDueToInactivity() {
    if (!isAuthenticated.value) return;
    await signOut();
  }

  function resetInactivityTimer() {
    if (typeof window === "undefined") return;
    if (!isAuthenticated.value) {
      clearInactivityTimer();
      return;
    }
    clearInactivityTimer();
    inactivityTimer = setTimeout(() => {
      void signOutDueToInactivity();
    }, inactivityLogoutMs.value);
  }

  function bindInactivityListeners() {
    if (typeof window === "undefined" || inactivityListenersBound) return;
    const onActivity = () => resetInactivityTimer();
    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, onActivity, { passive: true });
    });
    inactivityListenersBound = true;
  }

  function startInactivityMonitor() {
    bindInactivityListeners();
    if (!inactivityTimer) {
      resetInactivityTimer();
    }
  }

  function markReady() {
    if (!ready.value) {
      ready.value = true;
      readyResolve?.();
    }
  }

  async function whenReady() {
    if (ready.value) return;
    await readyPromise;
  }

  async function loadRole(uid: string) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .maybeSingle();

    if (error) throw error;
    appRole.value = (data?.role as AppRole | undefined) ?? "student";
  }

  async function repairProfileIfMissing() {
    const supabase = getSupabase();
    const { error } = await supabase.rpc("ensure_my_profile");
    if (error) {
      console.warn("ensure_my_profile:", error.message);
    }
  }

  async function loadProfile(uid: string) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("profiles")
      .select("display_name, email")
      .eq("id", uid)
      .maybeSingle();

    if (error) throw error;
    displayName.value = data?.display_name ?? displayName.value;
    if (data?.email) email.value = data.email;
  }

  async function applySession(session: { user: { id: string; email?: string | null } } | null) {
    if (!session?.user) {
      clearInactivityTimer();
      stayOnlineEnabled.value = false;
      userId.value = null;
      email.value = null;
      displayName.value = null;
      appRole.value = null;
      return;
    }
    userId.value = session.user.id;
    email.value = session.user.email ?? null;
    await repairProfileIfMissing();
    await loadRole(session.user.id);
    await loadProfile(session.user.id);
    loadSessionPreference();
    startInactivityMonitor();
  }

  function setStayOnlineEnabled(enabled: boolean) {
    if (!canUseExtendedSession.value) {
      stayOnlineEnabled.value = false;
      return;
    }
    stayOnlineEnabled.value = enabled;
    persistSessionPreference();
    resetInactivityTimer();
  }

  async function init() {
    bindInactivityListeners();
    if (useMock.value) {
      markReady();
      return;
    }

    const supabase = getSupabase();
    const { data } = await supabase.auth.getSession();
    await applySession(data.session);

    supabase.auth.onAuthStateChange(async (_event, session) => {
      await applySession(session);
    });

    markReady();
  }

  async function verifyStudentRegistry(studentId: string): Promise<boolean> {
    if (useMock.value) {
      const { useStudentRegistryStore } = await import("@/stores/studentRegistry");
      return !!useStudentRegistryStore().lookup(studentId);
    }
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc("verify_student_registry", {
      p_student_id: studentId,
    });
    if (error) throw error;
    return !!data;
  }

  async function fetchRegistryRow(studentId: string): Promise<{
    studentId: string;
    fullName: string;
    email?: string;
    college?: string;
    program?: string;
  } | null> {
    if (useMock.value) {
      const { useStudentRegistryStore } = await import("@/stores/studentRegistry");
      const row = useStudentRegistryStore().lookup(studentId);
      if (!row) return null;
      return {
        studentId: row.studentId,
        fullName: row.fullName,
        email: row.email,
        college: row.course,
        program: row.program,
      };
    }
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc("get_student_registry_row", {
      p_student_id: studentId,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    return {
      studentId: row.student_id as string,
      fullName: row.full_name as string,
      email: (row.email as string | null) ?? undefined,
      college: (row.college as string | null) ?? undefined,
      program: (row.program as string | null) ?? undefined,
    };
  }

  async function signIn(mail: string, password: string) {
    if (useMock.value) {
      loginMock(mail, mail.includes("admin") ? "Admin User" : "Portal User", mail.includes("admin") ? "admin" : "student");
      return { mock: true as const };
    }

    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: mail.trim(),
      password,
    });
    if (error) throw new Error(formatAuthError(error));
    await applySession(data.session);
    return { mock: false as const };
  }

  async function resendSignupConfirmation(mail: string) {
    if (useMock.value) return;

    const supabase = getSupabase();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: mail.trim(),
    });
    if (error) throw new Error(formatAuthError(error));
  }

  async function sendEmailOtp(mail: string) {
    if (useMock.value) return;
    const supabase = getSupabase();
    const { error } = await supabase.auth.signInWithOtp({
      email: mail.trim(),
      options: {
        shouldCreateUser: false,
      },
    });
    if (error) throw new Error(formatAuthError(error));
  }

  async function verifyEmailOtp(mail: string, token: string) {
    if (useMock.value) return;
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.verifyOtp({
      email: mail.trim(),
      token: token.trim(),
      type: "email",
    });
    if (error) throw new Error(formatAuthError(error));
    await applySession(data.session ?? null);
  }

  async function signUp(opts: {
    email: string;
    password: string;
    studentId: string;
    fullName: string;
  }): Promise<{ needsEmailConfirmation: boolean }> {
    if (useMock.value) {
      loginMock(opts.email, opts.fullName, "student");
      return { needsEmailConfirmation: false };
    }

    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signUp({
      email: opts.email.trim(),
      password: opts.password,
      options: {
        data: {
          student_id: opts.studentId,
          full_name: opts.fullName,
        },
      },
    });
    if (error) throw new Error(formatAuthError(error));

    if (data.session) {
      await applySession(data.session);
      return { needsEmailConfirmation: false };
    }

    // Supabase "Confirm email" is on — account exists but there is no session yet.
    await applySession(null);
    return { needsEmailConfirmation: true };
  }

  async function resetPassword(mail: string) {
    if (useMock.value) return;

    const supabase = getSupabase();
    const redirectTo = `${window.location.origin}/login`;
    const { error } = await supabase.auth.resetPasswordForEmail(mail.trim(), { redirectTo });
    if (error) throw error;
  }

  async function signOut() {
    clearInactivityTimer();
    if (useMock.value) {
      logout();
      return;
    }
    const supabase = getSupabase();
    await supabase.auth.signOut();
    userId.value = null;
    email.value = null;
    displayName.value = null;
    appRole.value = null;
  }

  /** Local-only fallback when Supabase env vars are missing. */
  function loginMock(e: string, name: string, r: string) {
    email.value = e;
    displayName.value = name;
    const roleMap: Record<string, AppRole> = {
      admin: "admin",
      student: "student",
      user: "student",
      "student-officer": "student_officer",
      officer: "student_officer",
      ssc: "ssc",
      adviser: "adviser",
      dean: "dean",
      osas: "osas",
      eo: "eo",
      gso: "gso",
    };
    appRole.value = roleMap[r] ?? "student";
    userId.value = "mock-user";
    loadSessionPreference();
    startInactivityMonitor();
  }

  function logout() {
    clearInactivityTimer();
    stayOnlineEnabled.value = false;
    email.value = null;
    displayName.value = null;
    appRole.value = null;
    userId.value = null;
  }

  return {
    ready,
    useMock,
    isSupabaseConfigured: isSupabaseConfigured,
    userId,
    email,
    displayName,
    appRole,
    stayOnlineEnabled,
    canUseExtendedSession,
    inactivityLogoutMs,
    role: computed(() => appRole.value),
    isAuthenticated,
    homePath,
    whenReady,
    init,
    verifyStudentRegistry,
    fetchRegistryRow,
    signIn,
    signUp,
    resendSignupConfirmation,
    sendEmailOtp,
    verifyEmailOtp,
    resetPassword,
    signOut,
    setStayOnlineEnabled,
    loginMock,
    logout,
  };
});

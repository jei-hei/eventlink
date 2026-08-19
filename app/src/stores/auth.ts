import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { ROLE_HOME_PATH, type AppRole } from "@/types/appRole";
import { useNotificationsStore } from "@/stores/notifications";

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
  const SINGLE_SESSION_CHECK_MS = 15 * 1000;
  const ACTIVITY_EVENTS = ["pointerdown", "keydown", "mousemove", "scroll", "touchstart"] as const;
  const EXTENDED_SESSION_ROLES = new Set<AppRole>(["eo", "gso", "osas"]);
  const SECURITY_EXEMPT_EMAIL_DOMAINS = new Set([
    "eventlink.local",
    "university.edu",
    "example.com",
    "example.org",
    "test.local",
    "localhost",
  ]);

  const ready = ref(false);
  const userId = ref<string | null>(null);
  const email = ref<string | null>(null);
  const displayName = ref<string | null>(null);
  const appRole = ref<AppRole | null>(null);
  const collegeId = ref<string | null>(null);
  const organizationId = ref<string | null>(null);
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
    if (appRole.value) return ROLE_HOME_PATH[appRole.value] ?? "/login";
    return "/student";
  });

  let readyResolve: (() => void) | null = null;
  const readyPromise = new Promise<void>((resolve) => {
    readyResolve = resolve;
  });
  let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  let singleSessionTimer: ReturnType<typeof setInterval> | null = null;
  let inactivityListenersBound = false;
  let currentSessionMarker: string | null = null;
  let lastActivityAt = 0;

  function sessionPreferenceKey() {
    if (!userId.value || !appRole.value) return null;
    return `eventlink:stay-online:${userId.value}:${appRole.value}`;
  }

  function lastActivityKey() {
    if (!userId.value) return null;
    return `eventlink:last-activity:${userId.value}`;
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

  function clearSingleSessionTimer() {
    if (singleSessionTimer) {
      clearInterval(singleSessionTimer);
      singleSessionTimer = null;
    }
  }

  function loadLastActivityAt() {
    if (typeof window === "undefined") return;
    const key = lastActivityKey();
    if (!key) {
      lastActivityAt = 0;
      return;
    }
    const raw = Number(window.localStorage.getItem(key) ?? "0");
    lastActivityAt = Number.isFinite(raw) && raw > 0 ? raw : 0;
  }

  function persistLastActivityAt(ts: number) {
    if (typeof window === "undefined") return;
    const key = lastActivityKey();
    if (!key) return;
    window.localStorage.setItem(key, String(ts));
  }

  function clearLastActivityAt() {
    lastActivityAt = 0;
    if (typeof window === "undefined") return;
    const key = lastActivityKey();
    if (!key) return;
    window.localStorage.removeItem(key);
  }

  function touchActivity() {
    const now = Date.now();
    lastActivityAt = now;
    persistLastActivityAt(now);
  }

  function isSecurityExemptEmail(mail: string | null | undefined): boolean {
    const domain = (mail ?? "").trim().toLowerCase().split("@")[1] ?? "";
    return SECURITY_EXEMPT_EMAIL_DOMAINS.has(domain);
  }

  function sessionMarkerKey() {
    if (!userId.value) return null;
    return `eventlink:session-marker:${userId.value}`;
  }

  function generateSessionMarker(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  async function fetchLoginMeta() {
    const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "Unknown device";
    let ip = "unknown";
    let location = "unknown";
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 2500);
      const res = await fetch("https://ipapi.co/json/", { signal: ctl.signal });
      clearTimeout(timer);
      if (res.ok) {
        const json = (await res.json()) as {
          ip?: string;
          city?: string;
          region?: string;
          country_name?: string;
        };
        ip = json.ip ?? ip;
        const parts = [json.city, json.region, json.country_name].filter(Boolean);
        if (parts.length) location = parts.join(", ");
      }
    } catch {
      // best effort only
    }
    return { userAgent, ip, location };
  }

  async function writeActiveSession(marker: string, showLoginAlert: boolean) {
    if (!userId.value) return;
    const supabase = getSupabase();
    const loginMeta = await fetchLoginMeta();
    const metadata = {
      browser: loginMeta.userAgent,
      ip: loginMeta.ip,
      location: loginMeta.location,
      logged_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("profiles")
      .update({
        active_session_id: marker,
        active_session_updated_at: new Date().toISOString(),
        last_login_metadata: metadata,
      })
      .eq("id", userId.value);
    if (error) throw error;

    if (typeof window !== "undefined") {
      const key = sessionMarkerKey();
      if (key) window.localStorage.setItem(key, marker);
    }

    const { error: notifyErr } = await supabase.from("notifications").insert({
      user_id: userId.value,
      title: "New login detected",
      body:
        `Device: ${metadata.browser}\n` +
        `IP: ${metadata.ip}\n` +
        `Location: ${metadata.location}\n` +
        `Time: ${new Date(metadata.logged_at).toLocaleString()}\n` +
        `If this wasn't you, use "This wasn't me" in Notifications.`,
      category: "security",
    });
    if (!notifyErr && showLoginAlert) {
      try {
        useNotificationsStore().push({
          title: "New login detected",
          body:
            `Device: ${metadata.browser}\n` +
            `IP: ${metadata.ip}\n` +
            `Location: ${metadata.location}\n` +
            `Time: ${new Date(metadata.logged_at).toLocaleString()}`,
          category: "security",
          href: "/forgot-password",
        });
      } catch {
        // store may not be ready yet
      }
    }
  }

  async function verifySingleSessionStillActive() {
    if (!userId.value || !currentSessionMarker) return;
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("profiles")
      .select("active_session_id")
      .eq("id", userId.value)
      .maybeSingle();
    if (error) return;
    const active = (data?.active_session_id as string | null) ?? null;
    if (active && active !== currentSessionMarker) {
      await signOut();
      if (typeof window !== "undefined") {
        window.alert(
          "Your account was signed in from another device, so this session was ended for security.",
        );
      }
    }
  }

  async function activateCurrentSessionSecurity(showLoginAlert: boolean) {
    if (useMock.value || !userId.value || isSecurityExemptEmail(email.value)) return;
    clearSingleSessionTimer();
    const marker = generateSessionMarker();
    currentSessionMarker = marker;
    await writeActiveSession(marker, showLoginAlert);
    singleSessionTimer = setInterval(() => {
      void verifySingleSessionStillActive();
    }, SINGLE_SESSION_CHECK_MS);
    await verifySingleSessionStillActive();
  }

  function resumeSingleSessionMonitorFromStorage() {
    if (useMock.value || !userId.value || isSecurityExemptEmail(email.value)) return;
    if (singleSessionTimer && currentSessionMarker) return;
    if (typeof window !== "undefined") {
      const key = sessionMarkerKey();
      const stored = key ? window.localStorage.getItem(key) : null;
      if (stored) currentSessionMarker = stored;
    }
    if (!currentSessionMarker) return;
    singleSessionTimer = setInterval(() => {
      void verifySingleSessionStillActive();
    }, SINGLE_SESSION_CHECK_MS);
    void verifySingleSessionStillActive();
  }

  async function signOutDueToInactivity() {
    if (!isAuthenticated.value) return;
    await signOut();
  }

  async function enforceInactivityNow() {
    if (!isAuthenticated.value) {
      clearInactivityTimer();
      return;
    }

    if (!lastActivityAt) {
      loadLastActivityAt();
      if (!lastActivityAt) touchActivity();
    }

    const elapsed = Date.now() - lastActivityAt;
    if (elapsed >= inactivityLogoutMs.value) {
      await signOutDueToInactivity();
      return;
    }
    resetInactivityTimer();
  }

  let resumeRevalidatePromise: Promise<{ ok: boolean; signedOut?: boolean }> | null = null;

  /**
   * When a backgrounded tab becomes visible again, browser timers were throttled so
   * Supabase may have a stale access token. Refresh the session before any API work.
   */
  async function revalidateSessionOnResume(): Promise<{ ok: boolean; signedOut?: boolean }> {
    if (resumeRevalidatePromise) return resumeRevalidatePromise;

    resumeRevalidatePromise = (async () => {
      if (useMock.value) {
        await enforceInactivityNow();
        return { ok: isAuthenticated.value };
      }

      await enforceInactivityNow();
      if (!isAuthenticated.value) return { ok: false, signedOut: true };

      const supabase = getSupabase();
      try {
        const { data, error } = await supabase.auth.refreshSession();
        if (error || !data.session) {
          const { data: existing } = await supabase.auth.getSession();
          if (!existing.session) {
            try {
              await supabase.auth.signOut({ scope: "local" });
            } catch {
              // ignore
            }
            logout();
            return { ok: false, signedOut: true };
          }
          if (!userId.value) {
            await applySession(existing.session, { enforceSingleSession: false, showLoginAlert: false });
          }
        } else if (!userId.value) {
          await applySession(data.session, { enforceSingleSession: false, showLoginAlert: false });
        }
      } catch {
        const { data: existing } = await supabase.auth.getSession();
        if (!existing.session) {
          try {
            await supabase.auth.signOut({ scope: "local" });
          } catch {
            // ignore
          }
          logout();
          return { ok: false, signedOut: true };
        }
      }

      resumeSingleSessionMonitorFromStorage();
      void verifySingleSessionStillActive();
      resetInactivityTimer();
      return { ok: true };
    })().finally(() => {
      resumeRevalidatePromise = null;
    });

    return resumeRevalidatePromise;
  }

  function resetInactivityTimer() {
    if (typeof window === "undefined") return;
    if (!isAuthenticated.value) {
      clearInactivityTimer();
      return;
    }
    if (!lastActivityAt) touchActivity();
    clearInactivityTimer();
    const elapsed = Date.now() - lastActivityAt;
    const remaining = Math.max(0, inactivityLogoutMs.value - elapsed);
    inactivityTimer = setTimeout(() => {
      void enforceInactivityNow();
    }, remaining);
  }

  function bindInactivityListeners() {
    if (typeof window === "undefined" || inactivityListenersBound) return;
    const onActivity = () => {
      touchActivity();
      resetInactivityTimer();
    };
    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, onActivity, { passive: true });
    });
    window.addEventListener("focus", () => {
      void revalidateSessionOnResume();
    });
    window.addEventListener("pageshow", () => {
      void revalidateSessionOnResume();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        void revalidateSessionOnResume();
      }
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
      .select("display_name, email, college_id, organization_id")
      .eq("id", uid)
      .maybeSingle();

    if (error) throw error;
    displayName.value = data?.display_name ?? displayName.value;
    if (data?.email) email.value = data.email;
    collegeId.value = (data?.college_id as string | null | undefined) ?? null;
    organizationId.value = (data?.organization_id as string | null | undefined) ?? null;
  }

  async function applySession(
    session: { user: { id: string; email?: string | null } } | null,
    opts?: { enforceSingleSession?: boolean; showLoginAlert?: boolean },
  ) {
    const enforceSingleSession = opts?.enforceSingleSession ?? true;
    const showLoginAlert = opts?.showLoginAlert ?? false;
    if (!session?.user) {
      clearInactivityTimer();
      clearSingleSessionTimer();
      currentSessionMarker = null;
      clearLastActivityAt();
      stayOnlineEnabled.value = false;
      userId.value = null;
      email.value = null;
      displayName.value = null;
      appRole.value = null;
      collegeId.value = null;
      organizationId.value = null;
      try {
        useNotificationsStore().clear();
      } catch {
        // ignore store lifecycle timing issues
      }
      return;
    }
    userId.value = session.user.id;
    email.value = session.user.email ?? null;
    await repairProfileIfMissing();
    await loadRole(session.user.id);
    await loadProfile(session.user.id);
    try {
      await useNotificationsStore().hydrate(true);
    } catch {
      // best effort: login should not fail due to notification hydration
    }
    loadSessionPreference();
    loadLastActivityAt();
    startInactivityMonitor();
    await enforceInactivityNow();
    if (isSecurityExemptEmail(session.user.email ?? email.value)) {
      clearSingleSessionTimer();
      currentSessionMarker = null;
    } else if (enforceSingleSession) {
      await activateCurrentSessionSecurity(showLoginAlert);
    } else {
      resumeSingleSessionMonitorFromStorage();
    }
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
    await applySession(data.session, { enforceSingleSession: true, showLoginAlert: false });

    supabase.auth.onAuthStateChange(async (event, session) => {
      await applySession(session, {
        enforceSingleSession: event === "SIGNED_IN",
        showLoginAlert: false,
      });
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

  async function signIn(mail: string, password: string, opts?: { provisional?: boolean }) {
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
    await applySession(data.session, {
      enforceSingleSession: !opts?.provisional,
      showLoginAlert: !opts?.provisional,
    });
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
    await applySession(data.session ?? null, {
      enforceSingleSession: true,
      showLoginAlert: true,
    });
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
    clearSingleSessionTimer();
    currentSessionMarker = null;
    clearLastActivityAt();
    if (useMock.value) {
      logout();
      return;
    }
    const supabase = getSupabase();
    // Always clear local auth first so logout never hangs on a stale/expired JWT.
    logout();
    try {
      await Promise.race([
        supabase.auth.signOut({ scope: "global" }),
        new Promise<void>((resolve) => {
          window.setTimeout(resolve, 4000);
        }),
      ]);
    } catch {
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // Local UI already cleared.
      }
    }
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
      it_infrastructure: "it_infrastructure",
      "it-infrastructure": "it_infrastructure",
      sports_office: "sports_office",
      "sports-office": "sports_office",
    };
    appRole.value = roleMap[r] ?? "student";
    userId.value = "mock-user";
    loadSessionPreference();
    startInactivityMonitor();
  }

  function logout() {
    clearInactivityTimer();
    clearSingleSessionTimer();
    currentSessionMarker = null;
    clearLastActivityAt();
    stayOnlineEnabled.value = false;
    email.value = null;
    displayName.value = null;
    appRole.value = null;
    collegeId.value = null;
    organizationId.value = null;
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
    collegeId,
    organizationId,
    stayOnlineEnabled,
    canUseExtendedSession,
    inactivityLogoutMs,
    role: computed(() => appRole.value),
    isAuthenticated,
    homePath,
    whenReady,
    init,
    revalidateSessionOnResume,
    verifyStudentRegistry,
    fetchRegistryRow,
    signIn,
    signUp,
    resendSignupConfirmation,
    sendEmailOtp,
    verifyEmailOtp,
    activateCurrentSessionSecurity,
    resetPassword,
    signOut,
    setStayOnlineEnabled,
    loginMock,
    logout,
  };
});

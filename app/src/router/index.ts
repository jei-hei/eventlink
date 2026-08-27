import { createRouter, createWebHistory } from "vue-router";
import { installRouterGuards } from "./guards";
import type { AppRole } from "@/types/appRole";

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior(to, _from, saved) {
    if (saved) return saved;
    if (to.hash) return { el: to.hash, behavior: "smooth" };
    return { top: 0, behavior: "smooth" };
  },
  routes: [
    { path: "/", redirect: "/login" },
    {
      path: "/login",
      name: "login",
      component: () => import("@/views/auth/LoginView.vue"),
    },
    {
      path: "/signup",
      name: "signup",
      component: () => import("@/views/auth/SignupView.vue"),
    },
    {
      path: "/forgot-password",
      name: "forgot-password",
      component: () => import("@/views/auth/ForgotPasswordView.vue"),
    },
    {
      path: "/student/profile",
      name: "student-profile",
      meta: { portalRole: "student", profileStandalone: true, allowedRoles: ["student"] as AppRole[] },
      component: () => import("@/views/profile/ProfileView.vue"),
    },
    {
      path: "/student/monitoring",
      name: "student-monitoring",
      meta: { allowedRoles: ["student"] as AppRole[] },
      component: () => import("@/views/student/MonitoringView.vue"),
    },
    {
      path: "/student",
      name: "student-events",
      component: () => import("@/views/student/EventsHomeView.vue"),
    },
    {
      path: "/student-officer",
      meta: { allowedRoles: ["student_officer"] as AppRole[] },
      component: () => import("@/views/student-officer/OfficerLayout.vue"),
      children: [
        { path: "", name: "officer-dashboard", component: () => import("@/views/student-officer/DashboardView.vue") },
        { path: "events", name: "officer-events", component: () => import("@/components/portal/EventMonitoringView.vue") },
        {
          path: "analytics",
          name: "officer-analytics",
          component: () => import("@/views/student-officer/AnalyticsView.vue"),
        },
        {
          path: "profile",
          name: "officer-profile",
          meta: { portalRole: "student-officer" },
          component: () => import("@/views/profile/ProfileView.vue"),
        },
      ],
    },
    {
      path: "/executive-officer",
      meta: { allowedRoles: ["eo"] as AppRole[] },
      component: () => import("@/views/executive-officer/ExecutiveLayout.vue"),
      children: [
        { path: "", name: "eo-dashboard", component: () => import("@/views/executive-officer/DashboardView.vue") },
        { path: "events", name: "eo-events", component: () => import("@/components/portal/EventMonitoringView.vue") },
        { path: "analytics", name: "eo-analytics", component: () => import("@/views/executive-officer/AnalyticsView.vue") },
        {
          path: "settings",
          name: "eo-settings",
          component: () => import("@/views/staff/SessionSettingsView.vue"),
        },
        {
          path: "profile",
          name: "eo-profile",
          meta: { portalRole: "eo" },
          component: () => import("@/views/profile/ProfileView.vue"),
        },
      ],
    },
    {
      path: "/gso",
      meta: { allowedRoles: ["gso"] as AppRole[] },
      component: () => import("@/views/gso/GsoLayout.vue"),
      children: [
        { path: "", name: "gso-dashboard", component: () => import("@/views/gso/DashboardView.vue") },
        { path: "venues", name: "gso-venues", component: () => import("@/views/gso/VenuesView.vue") },
        { path: "equipment", name: "gso-equipment", component: () => import("@/views/gso/EquipmentView.vue") },
        { path: "analytics", name: "gso-analytics", component: () => import("@/views/gso/AnalyticsView.vue") },
        {
          path: "settings",
          name: "gso-settings",
          component: () => import("@/views/staff/SessionSettingsView.vue"),
        },
        {
          path: "profile",
          name: "gso-profile",
          meta: { portalRole: "gso" },
          component: () => import("@/views/profile/ProfileView.vue"),
        },
      ],
    },
    {
      path: "/it-infrastructure",
      meta: { allowedRoles: ["it_infrastructure"] as AppRole[] },
      component: () => import("@/views/it-infrastructure/ItLayout.vue"),
      children: [
        { path: "", name: "it-dashboard", component: () => import("@/views/it-infrastructure/DashboardView.vue") },
        {
          path: "equipment",
          name: "it-equipment",
          component: () => import("@/views/it-infrastructure/EquipmentView.vue"),
        },
        { path: "requests", redirect: { name: "it-dashboard" } },
        {
          path: "analytics",
          name: "it-analytics",
          component: () => import("@/views/it-infrastructure/AnalyticsView.vue"),
        },
        {
          path: "profile",
          name: "it-profile",
          meta: { portalRole: "it-infrastructure" },
          component: () => import("@/views/profile/ProfileView.vue"),
        },
      ],
    },
    {
      path: "/sports-office",
      meta: { allowedRoles: ["sports_office"] as AppRole[] },
      component: () => import("@/views/sports-office/SportsLayout.vue"),
      children: [
        {
          path: "",
          name: "sports-dashboard",
          component: () => import("@/views/sports-office/DashboardView.vue"),
        },
        {
          path: "venues",
          name: "sports-venues",
          component: () => import("@/views/sports-office/VenuesView.vue"),
        },
        { path: "requests", redirect: { name: "sports-dashboard" } },
        {
          path: "analytics",
          name: "sports-analytics",
          component: () => import("@/views/sports-office/AnalyticsView.vue"),
        },
        {
          path: "profile",
          name: "sports-profile",
          meta: { portalRole: "sports-office" },
          component: () => import("@/views/profile/ProfileView.vue"),
        },
      ],
    },
    {
      path: "/osas",
      meta: { allowedRoles: ["osas"] as AppRole[] },
      component: () => import("@/views/osas/OsasLayout.vue"),
      children: [
        { path: "", name: "osas-dashboard", component: () => import("@/views/osas/DashboardView.vue") },
        { path: "analytics", name: "osas-analytics", component: () => import("@/views/osas/AnalyticsView.vue") },
        {
          path: "monitoring",
          name: "osas-monitoring",
          component: () => import("@/components/portal/EventMonitoringView.vue"),
        },
        {
          path: "settings",
          name: "osas-settings",
          component: () => import("@/views/staff/SessionSettingsView.vue"),
        },
        {
          path: "profile",
          name: "osas-profile",
          meta: { portalRole: "osas" },
          component: () => import("@/views/profile/ProfileView.vue"),
        },
      ],
    },
    {
      path: "/dean",
      meta: { allowedRoles: ["dean"] as AppRole[] },
      component: () => import("@/views/dean/DeanLayout.vue"),
      children: [
        { path: "", name: "dean-dashboard", component: () => import("@/views/dean/DashboardView.vue") },
        { path: "analytics", name: "dean-analytics", component: () => import("@/views/dean/AnalyticsView.vue") },
        {
          path: "monitoring",
          name: "dean-monitoring",
          component: () => import("@/components/portal/EventMonitoringView.vue"),
        },
        {
          path: "profile",
          name: "dean-profile",
          meta: { portalRole: "dean" },
          component: () => import("@/views/profile/ProfileView.vue"),
        },
      ],
    },
    {
      path: "/adviser",
      meta: { allowedRoles: ["adviser"] as AppRole[] },
      component: () => import("@/views/adviser/AdviserLayout.vue"),
      children: [
        { path: "", name: "adviser-dashboard", component: () => import("@/views/adviser/DashboardView.vue") },
        { path: "analytics", name: "adviser-analytics", component: () => import("@/views/adviser/AnalyticsView.vue") },
        {
          path: "monitoring",
          name: "adviser-monitoring",
          component: () => import("@/components/portal/EventMonitoringView.vue"),
        },
        {
          path: "profile",
          name: "adviser-profile",
          meta: { portalRole: "adviser" },
          component: () => import("@/views/profile/ProfileView.vue"),
        },
      ],
    },
    {
      path: "/ssc",
      meta: { allowedRoles: ["ssc"] as AppRole[] },
      component: () => import("@/views/ssc/SscLayout.vue"),
      children: [
        { path: "", name: "ssc-dashboard", component: () => import("@/views/ssc/DashboardView.vue") },
        { path: "events", name: "ssc-events", component: () => import("@/components/portal/EventMonitoringView.vue") },
        { path: "analytics", name: "ssc-analytics", component: () => import("@/views/ssc/AnalyticsView.vue") },
        { path: "venues", name: "ssc-venues", component: () => import("@/views/ssc/VenuesView.vue") },
        { path: "equipment", name: "ssc-equipment", component: () => import("@/views/ssc/EquipmentView.vue") },
        {
          path: "profile",
          name: "ssc-profile",
          meta: { portalRole: "ssc" },
          component: () => import("@/views/profile/ProfileView.vue"),
        },
      ],
    },
    {
      path: "/admin",
      meta: { allowedRoles: ["admin"] as AppRole[] },
      component: () => import("@/views/admin/AdminLayout.vue"),
      children: [
        { path: "", name: "admin-dashboard", component: () => import("@/views/admin/DashboardView.vue") },
        { path: "users", name: "admin-users", component: () => import("@/views/admin/UsersView.vue") },
        { path: "students", name: "admin-students", component: () => import("@/views/admin/StudentsView.vue") },
        { path: "ssc", name: "admin-ssc", component: () => import("@/views/admin/SscView.vue") },
        { path: "colleges", name: "admin-colleges", component: () => import("@/views/admin/CollegesView.vue") },
        { path: "reports", name: "admin-reports", component: () => import("@/views/admin/ReportsView.vue") },
        { path: "settings", name: "admin-settings", component: () => import("@/views/admin/SettingsView.vue") },
        {
          path: "profile",
          name: "admin-profile",
          meta: { portalRole: "admin" },
          component: () => import("@/views/profile/ProfileView.vue"),
        },
      ],
    },
  ],
});

installRouterGuards(router);

export default router;

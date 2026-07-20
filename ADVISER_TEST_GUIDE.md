# EventLink Adviser Guide (Short Version)

This guide gives a short but detailed description of each user, the main features, and the security controls used in EventLink.

## System Overview

EventLink is a role-based event workflow platform for the university.  
Event requests move through assigned approvers, then approved events are published to student-facing feeds and staff calendars.

## User Descriptions (Per Role)

- `Admin` - Manages portal users, registry data, colleges, organizations, and reports. Creates staff accounts with required role mapping (college/organization where needed).
- `Student Officer` - Creates event requests for their own organization, tracks status, and publishes approved event posts to the student feed.
- `SSC` - Handles SSC-scope requests and publishing, similar to Student Officer but for SSC operations.
- `Adviser` - Reviews requests only for the assigned organization. Cannot process requests outside that organization.
- `Dean` - Reviews requests only for the assigned college. Cannot process requests outside that college.
- `OSAS` - Handles the OSAS approval stage after dean approval.
- `EO` - Handles scheduling/publish stage and analytics monitoring; final publishing actions route through EO stages.
- `GSO` - Handles venue/equipment checks and inventory-related approvals when required by a request.
- `Student` - Views published events, opens event details/media, and consumes official event announcements.

## Workflow Features

- `Approval Flow` - Student Officer/SSC -> Adviser -> Dean -> OSAS -> EO -> GSO (if needed) -> EO publish.
- `Scope Routing` - Adviser visibility is organization-scoped; Dean visibility is college-scoped.
- `Status Tracking` - Requests keep step and status history from submission to final publish.
- `Admin User Provisioning` - Admin can create backend users through the in-app flow with role-required fields.

## User Experience Features

- `Student Feed` - Supports post captions and multi-image uploads from authorized roles.
- `Media Preview` - Students can click images, open fullscreen preview, and navigate next/previous images.
- `Profile Management` - Profile photo, office details, and account preferences persist to backend storage/database.
- `Role-Safe Editing` - Student email editing is restricted in profile UI (change should go through admin office).

## Security Features

- `Email OTP` - Enabled for non-student users with real email domains.
- `Test Domain Exemption` - Fake/test email domains can bypass strict OTP/session hardening for demo use.
- `Brute-force Protection` - 3 failed logins trigger a 60-second lockout.
- `Single Active Session` - New login can terminate previous active session for protected accounts.
- `Login Security Alerts` - Security notification is recorded for new login activity.
- `Inactivity Auto-Logout` - Session expiration is enforced by idle-time checks (including tab return/focus checks), with role-based timeout behavior.
- `OTP Failure Safety` - If OTP sending is rate-limited or fails, provisional session is cleared to prevent accidental access.

## Quick Adviser Validation Checklist

- [ ] Adviser only sees requests for assigned organization.
- [ ] Dean only sees requests for assigned college.
- [ ] End-to-end approval path completes correctly.
- [ ] Student feed posts and multi-image preview work.
- [ ] OTP + lockout + single-session security work for real-email non-student accounts.

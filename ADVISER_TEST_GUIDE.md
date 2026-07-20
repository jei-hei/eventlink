# EventLink Adviser Testing Guide

This guide is for adviser/faculty testing before final presentation.
It verifies core features, security, routing, uploads, and backend persistence.

## 1) Test Environment Checklist

Before testing in app, confirm backend is updated:

1. Latest frontend is pulled (`main` branch).
2. Latest SQL migrations are applied in Supabase (especially newest timestamps).
3. Edge function is deployed:
   - `admin-create-user`
4. Supabase project is linked to correct environment (not old/test project).

If any step above is missing, some features may look broken even if code is correct.

## 2) Recommended Test Accounts

Use one account per role:

- `admin`
- `student_officer`
- `ssc`
- `adviser`
- `dean`
- `osas`
- `eo`
- `gso`
- `student`

Notes:

- OTP is enforced for non-student users with real email domains.
- Test/fake domains in exemption list skip strict OTP/session rules.
- To test OTP properly, create at least one non-student with a real email.

## 3) Core Functional Test Flow (Priority Order)

## A. Admin Account Provisioning

1. Log in as Admin.
2. Go to `Admin > Users > Add user`.
3. Create:
   - Dean: must require College.
   - Adviser: must require College + Organization.
   - Student Officer: must require College + Organization.
4. Confirm new user appears in user list with correct role info.

Expected:

- Account is created successfully.
- Role-specific required fields are enforced.
- User can sign in with created credentials.

## B. Security Login Behavior

Use a non-student real-email account.

1. Enter correct password.
2. Confirm OTP code is requested.
3. Enter wrong password 3 times in a row.

Expected:

- OTP required before full access.
- 3 wrong attempts trigger 60-second lockout.
- If OTP email rate limit is hit, user must NOT be auto-logged in after refresh.

## C. Workflow Routing by Organization and College

Create two officers from different orgs/colleges, for example:

- Officer A: College CCSICT, Organization SBO
- Officer B: College CCSICT, Organization JPCS
- Officer C: Different college/org

Test:

1. Submit event from Officer A.
2. Adviser queue should show it only for SBO adviser.
3. After adviser approval, dean queue should show it for CCSICT dean.
4. Submit event from Officer B.
5. Adviser queue should show it only for JPCS adviser.
6. Dean queue should still route to CCSICT dean.
7. Submit event from Officer C.
8. Routing should follow Officer C's own org and college chain.

Expected:

- Adviser can act only on same-organization requests.
- Dean can act only on same-college requests.
- Requests do not leak to other advisers/deans.

## D. End-to-End Approval and Posting

For one request with GSO needed:

1. Officer/SSC submits.
2. Adviser approves.
3. Dean approves.
4. OSAS approves.
5. EO approves schedule.
6. GSO approves (inventory/venue path).
7. EO posts to calendar.
8. Officer/SSC publishes student feed post.

Expected:

- Status and step advance correctly.
- History entries are recorded.
- Equipment decrement occurs when applicable.

## E. Student Feed Post (Multi-Image)

1. As SSC or Student Officer, open Create Post.
2. Upload multiple images (2-5 is enough for test).
3. Publish to student feed.
4. Open student dashboard feed.
5. Click different images.

Expected:

- Post saves with all images.
- Feed shows image grid.
- Clicking a specific image opens full-screen preview.
- Prev/Next controls navigate images.
- Refresh keeps post and images (backend persistence).

## F. Profile Save and Upload Persistence

For at least one staff account:

1. Open profile.
2. Upload profile photo.
3. Update office fields and save.
4. Refresh and re-login.

Expected:

- Photo remains after refresh/re-login.
- Office/settings fields remain saved.
- No local-only loss after browser reload.

## G. Single Active Session

Use one non-student real-email account:

1. Login in Browser A.
2. Login same account in Browser B.

Expected:

- Previous session is terminated.
- Security notification appears for new login.

## 4) Quick Pass/Fail Sheet

Mark each as PASS/FAIL:

- [ ] Admin user creation with role-required fields
- [ ] OTP challenge for real-email non-student
- [ ] Lockout after 3 wrong passwords
- [ ] No OTP bypass via refresh/session leak
- [ ] Org/college workflow routing accuracy
- [ ] End-to-end approval chain
- [ ] Student feed multi-image upload and preview
- [ ] Profile photo persistence after reload
- [ ] Office/profile settings persistence
- [ ] Single-session enforcement

## 5) If Something Fails

Capture these details before reporting:

1. Role and account used.
2. Exact page and action.
3. Exact error text/toast shown.
4. Whether issue persists after refresh/re-login.
5. Whether SQL migrations and edge function deploy were already applied.

This makes debugging fast and precise.

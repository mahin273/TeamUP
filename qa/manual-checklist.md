# Manual QA Checklist & Demo Rehearsal Runbook (Phase 12)

**Test Session Information**
- **Date**: 2026-09-30
- **QA Lead / Tester**: QA Engineering Team
- **Test Devices**:
  - Primary: Google Pixel 7 (Android 14) / Expo Go & Release APK
  - Secondary: iPhone 13 (iOS 17) / Expo Go
  - Low-End Android: Samsung Galaxy A13 (Android 11 Go)
- **Backend Build / Commit**: `origin/QA-Testing`

---

## 1. Rapid Smoke Test (Every Build, ~10 Minutes)

| Check / Action | Expected Result | Device / Env | Result | Notes / Status |
|---|---|---|---|---|
| **SMOKE-01**: App launch | Splash screen loads cleanly into Auth Landing without crash or white screen | Pixel 7 / iPhone 13 | [x] PASS | Verified |
| **SMOKE-02**: Auth Cycle | Register new user, verify JWT in SecureStore, log out to Login screen, log back in | Pixel 7 / iPhone 13 | [x] PASS | Session tokens persisted |
| **SMOKE-03**: Profile & Skills | Add skills (chips), remove a skill, toggle availability status to "Busy" and reload | Pixel 7 | [x] PASS | State saved to DB |
| **SMOKE-04**: Marketplace Search | Browse marketplace list, apply category filter, execute debounced keyword search | Pixel 7 / iPhone 13 | [x] PASS | Search results accurate |
| **SMOKE-05**: Team Formation | Project leader invites a candidate; leader accepts join request via members list | Pixel 7 | [x] PASS | Status becomes ACCEPTED |
| **SMOKE-06**: Workspace & Kanban | Open workspace, create a new task with assignee, drag/move task across 4 columns | Pixel 7 / iPhone 13 | [x] PASS | Optimistic move persisted |
| **SMOKE-07**: Real-time Chat | Two devices in the same project room exchange instant messages | Pixel 7 & iPhone 13 | [x] PASS | < 100ms delivery |
| **SMOKE-08**: File Sharing | Upload a PDF document, view metadata & thumbnail, download / open file | Pixel 7 | [x] PASS | File stored & retrievable |
| **SMOKE-09**: Meeting Voting | Propose a meeting with 2 slots, vote on a preferred slot, verify confirmed state | Pixel 7 & iPhone 13 | [x] PASS | Confirmed slot highlighted |
| **SMOKE-10**: Analytics View | View project completion rate, task breakdown charts, member contribution stats | Pixel 7 | [x] PASS | No NaN values |
| **SMOKE-11**: Peer Evaluation | Submit 5 criteria evaluation (1-5 ratings) for a teammate; check submitted tab | Pixel 7 | [x] PASS | Saved; self excluded |
| **SMOKE-12**: Idea Generator | Submit prompt to AI Idea Hub, view stream/result, verify fallback on timeout | Pixel 7 | [x] PASS | Suggestion displayed |
| **SMOKE-13**: Notifications | Trigger action (task assigned), verify in-app notification badge and push delivery | Pixel 7 / iPhone 13 | [x] PASS | Notification received |

---

## 2. Demo Rehearsal & Live Presentation Checklist

- [x] **Seeded Cohort**: 15–20 student profiles pre-seeded with diverse skills (React, Node, UI/UX, Python, DevOps) on demo server.
- [x] **Curated Projects**:
  - 1 `OPEN` recruiting project with required skills.
  - 1 `IN_PROGRESS` project with Kanban tasks in every column (`TODO`, `IN_PROGRESS`, `TESTING`, `DONE`) and chat history.
  - 1 `COMPLETED` project with submitted peer evaluations and populated analytics dashboard.
- [x] **Two-Device Chat Rehearsal**: Rehearsed live messaging 3 times across two phones; confirmed instant sync.
- [x] **GitHub Integration**: Dedicated demo GitHub account linked with active repos, commit stats, and fallback simulation.
- [x] **Idea Generator Fallback**: API key verified with Gemini quota; pre-generated idea prompt cards saved in case of network latency.
- [x] **Push Notification Verification**: Demo devices registered with push tokens; test push delivered successfully.
- [x] **App Deployment & Hardware**: APK / Expo Go installed on two test devices, plus a charged backup device.
- [x] **Backend Infrastructure & Recovery**: Server health check monitored; quick restart script verified (`npm run start:prod`).
- [x] **Credentials & Connectivity**:
  - Demo login credentials written on cue cards (avoiding hardcoded secrets in slides/repo).
  - Mobile 5G Wi-Fi hotspot tested and configured as primary/backup connection.
- [x] **Product Positioning**: AI Idea Hub explicitly presented as an "LLM-assisted suggestion tool" with graceful fallback.

---

## 3. Known Findings & Characterisation Log (Confirmed Backend Behavior)

| # | Finding Description | Severity | Impact & Recommended Next Step |
|---|---|---|---|
| **F-1** | **Invited User Status Action Gap**: An invited user currently has no endpoint or UI button to accept or decline an invitation; only the project leader can transition the member status. | Major (Functional gap) | Documented in `FE_TEST_CASES.md` (GAP-03 / FE-09). Recommend adding `PATCH /projects/:id/members/me` (`ACCEPT` / `DECLINE`). |
| **F-2** | **Task State Machine Flexibility**: Task status changes do not enforce strict linear progression (e.g. `TODO` can jump straight to `DONE` or reopen). | Minor / Design decision | Current behavior verified via characterisation tests (`TASK-06`, `TASK-07`). Permissive workflow chosen for MVP agility. |
| **F-3** | **Peer Evaluation Identity Exposure**: Evaluation endpoints expose evaluator identity and feedback comments to project leaders/teammates. | Major (Privacy consideration) | Intended as collaborative peer feedback for student hackathons; an anonymous evaluation toggle can be scheduled for v2. |
| **F-4** | **Unrestricted Evaluation Timing**: Evaluations can technically be posted while a project is still `OPEN` or `IN_PROGRESS`. | Minor / Product decision | Tests characterising this behavior pass. A check `project.status === 'COMPLETED'` can be enforced if strict gating is preferred. |
| **F-5** | **Zero-Vote Meeting Tie-Break**: A proposed meeting with 0 member votes is automatically confirmed using the earliest proposed time slot. | Minor / Product rule | Deterministic tie-breaker prevents scheduling deadlock. Documented as expected behavior in `SCH-10`. |
| **F-6** | **Bookmark Type Alignment**: `BookmarkType` enum currently supports `PROJECT` and `IDEA`, without a distinct `USER` bookmark type. | Minor | Documented; profile bookmarking handled via matching bookmarks or candidate shortlist. |

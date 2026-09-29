# Frontend Test Matrix & Manual QA Verification (Phase 9)

## 1. Automated & Remaining Frontend Test Cases (FE-01 - FE-19)

| ID | Screen / Area | Scenario / Verification | Priority | Automated Test Location / Status |
|---|---|---|---|---|
| **FE-01** | Register | Validation messages for empty and invalid fields, submit disabled while loading | P0 | Covered in `client/__tests__/LoginScreen.test.tsx` (validation & double-tap guard pattern) & `client/src/__tests__/AuthProfile.test.tsx` |
| **FE-02** | Login | Wrong credentials show error banner. Double-tap sends exactly one API request | P0 | Automated: `client/__tests__/LoginScreen.test.tsx` |
| **FE-03** | Auth Flow | Unauthenticated user redirected to Login screen; tokens stored securely in Expo SecureStore | P0 | Automated: `client/src/__tests__/Phase0Foundations.test.tsx` & `AuthProfile.test.tsx` |
| **FE-04** | Profile Edit | Add and remove skill chips. Availability toggle persists state | P0 | Automated: `client/src/__tests__/AuthProfile.test.tsx` |
| **FE-05** | Marketplace | Loading skeleton, project list, empty and error states. Pull-to-refresh reload | P0 | Automated: `client/src/__tests__/Phase1Marketplace.test.tsx` |
| **FE-06** | Search | Debounced query input. Filter modal and clear filters button reset search | P0 | Automated: `client/src/__tests__/Search.test.tsx` |
| **FE-07** | Project Detail | Role-based action buttons: Owner (Edit/Manage), Member (Workspace/Chat), Outsider (Apply/Request Join) | P0 | Automated: `client/src/__tests__/Phase2Workspace.test.tsx` |
| **FE-08** | Members (Leader) | Project owner/leader can approve or reject `PENDING` join requests | P0 | Automated: `client/src/__tests__/Phase2Workspace.test.tsx` |
| **FE-09** | Invitee View | **Known Gap / Documented**: Invitee currently lacks explicit accept/decline UI for direct invitations. Backlogged for frontend team. | P0 | Logged for Frontend Team (Tracked under FE-09 / GAP-03) |
| **FE-10** | Kanban Board | 4 columns (`TODO`, `IN_PROGRESS`, `TESTING`, `DONE`). Drag/drop optimistic move with rollback on API failure | P0 | Automated: `client/src/__tests__/Phase3Kanban.test.tsx` |
| **FE-11** | Chat Room | Message history renders. New Socket.io message appends. Send button disabled when text is empty | P0 | Automated: `client/src/__tests__/Phase4Chat.test.tsx` |
| **FE-12** | Chat Resilience | Socket disconnect triggers reconnecting status banner and automatic rejoin | P1 | Automated: `client/src/__tests__/Phase4Chat.test.tsx` |
| **FE-13** | File Management | Upload sheet, file category filter, size display, delete file by owner, error on rejected mime type | P1 | Automated: `client/src/__tests__/FilesScreen.test.tsx` |
| **FE-14** | Meeting Scheduler | Slot voting toggles vote count. Confirmed meeting slot is highlighted | P0 | Automated: `client/src/__tests__/Scheduler.test.tsx` & `Calendar.test.tsx` |
| **FE-15** | Peer Evaluation | 5 evaluation criteria (1-5 score pickers), all required, self cannot be evaluated, submitted state | P0 | Automated: `client/src/__tests__/EvaluationScreen.test.tsx` |
| **FE-16** | Analytics Dashboard| Zero-data fallback displays without `NaN` or divide-by-zero crashes, summary cards, chart sections | P0 | Automated: `client/src/__tests__/AnalyticsDashboard.test.tsx` |
| **FE-17** | AI Idea Hub | Loading indicator, project idea prompt submission, suggestions rendering, graceful error state | P0 | Automated: `client/src/__tests__/IdeaHub.test.tsx` |
| **FE-18** | Global API Client | 401 response invokes token refresh interceptor with queue retry; clears tokens and logs out if refresh fails | P0 | Automated: `client/__tests__/apiClient.test.ts` |
| **FE-19** | Offline Resilience | Network error displays friendly offline banner or retry button, avoiding blank screens | P0 | Automated: `client/src/__tests__/StateWrapper.test.tsx` & `FilesScreen.test.tsx` |

---

## 2. Manual Device Test Matrix

### Target Hardware & Environments
1. **Real Device 1 (Mid/High-End Android/iOS)**:
   - Device: Google Pixel 7 (Android 14) / iPhone 13 (iOS 17)
   - Runtime: Expo Go and production release APK / IPA build
2. **Real Device 2 (Low-End Android)**:
   - Device: Samsung Galaxy A13 / Xiaomi Redmi 9A (2GB RAM, Android 11 Go)
   - Runtime: Standalone APK build (testing memory pressure and JS thread responsiveness)

### Form Factors & System Configurations
- **Screen Dimensions**: Small screen (360x640dp) vs Large phone / Small tablet (412x915dp, 600x960dp).
- **Orientation**: Portrait standard, landscape rotation on Kanban board and Analytics charts.
- **Display Settings**: System dark mode switch, large font accessibility scale (1.5x / 2.0x font scaling without layout clipping).
- **Keyboard Handling**:
  - `KeyboardAvoidingView` on Auth (Login / Register forms) ensuring fields remain visible when virtual keyboard opens.
  - Chat input accessory bar stays pinned directly above the keyboard without obscuring the latest message.
- **Navigation Controls**:
  - Physical / gesture Android system back button on every screen verifies proper stack pop without unhandled exceptions or orphan modal locks.
- **Network Degradation**:
  - 3G network speed throttling (Chrome DevTools / Android network profiler).
  - Airplane mode toggled mid-flow (verifying non-crashing offline retry banners).
- **App Lifecycle**:
  - Clean fresh install (permissions, empty storage).
  - App upgrade over existing version (SecureStore token retention).
  - App backgrounding and foregrounding during active WebSocket chat connection.

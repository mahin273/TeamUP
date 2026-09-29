# Standardized Bug Report Template

```markdown
Bug ID:         BUG-###
Title:          [Short, descriptive summary of the defect]
Module / Owner: (Auth / Matching / Workspace / Chat / Scheduler / Eval / Analytics / AI / Notif / Mobile)
Severity:       Blocker | Critical | Major | Minor | Cosmetic
Priority:       P0 | P1 | P2
Environment:    Device: [e.g. Google Pixel 7] | OS: [e.g. Android 14] | App Build: [e.g. 1.0.0-rc1] | Backend Commit: [e.g. 14a5f07]

Steps to reproduce:
 1. 
 2. 
 3. 

Expected Behavior:
[Clear statement of what should have occurred per requirement or design doc]

Actual Behavior:
[Detailed description of what actually happened, including HTTP status codes, visual glitches, or unexpected state]

Attachments:
- Screenshot / Screen recording: [link or file path]
- API Request / Response payload: [JSON snippet]
- Client / Server console logs: [log excerpt]

Related Test ID:
[e.g. FILE-04, AUTH-14, CHAT-06, FE-09]

Status:
Open | In progress | Fixed | Verified | Won't fix
```

---

## Severity Classification Guide

- **Blocker**: App crash, data corruption/loss, inability to authenticate, or complete blockage of the core demo flow with no possible workaround.
- **Critical**: Security vulnerability (e.g. IDOR, secret leak), authentication bypass, or a primary feature completely broken for all users with no alternative.
- **Major**: A primary or secondary feature is broken, but an operational workaround exists (e.g. inviting user can be managed via API or leader dashboard).
- **Minor**: Small functional deviation, non-blocking edge-case bug, or confusing UI feedback that does not prevent feature completion.
- **Cosmetic**: Visual-only defect, typographical error, slight padding/color misalignment that has zero impact on functionality.

---

## Priority Matrix Guide

- **P0 (Immediate)**: Must be resolved immediately before any release or milestone demo.
- **P1 (High)**: Important defect that should be resolved in the current sprint / test cycle.
- **P2 (Normal)**: Non-urgent issue or polish item that can be scheduled for subsequent maintenance cycles.

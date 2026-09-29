# Performance, Database Index Verification & Resilience Runbook (Phase 11)

## 1. k6 Performance Smoke Test

Run the smoke test using k6:
```bash
k6 run -e BASE_URL=http://localhost:3000/api/v1 -e EMAIL=demo@x.com -e PASSWORD=Str0ng!Pass123 -e PROJECT_ID=<uuid> perf/k6-smoke.js
```

### Performance Target Thresholds
| ID | Target Endpoint / Capability | Latency / SLA Target | Priority | Status / Verification |
|---|---|---|---|---|
| **PERF-01** | `GET /projects?page=1&limit=20` | p95 < 300 ms | P1 | Verified with pagination & index on `createdAt` / `status` |
| **PERF-02** | `GET /projects/:id/recommendations` (200 candidates) | p95 < 500 ms, no N+1 queries | P1 | Single-pass query using indexed skill joins and precomputed availability |
| **PERF-03** | `GET /projects/:id/tasks` (200 tasks) | p95 < 300 ms | P1 | Bounded query with index on `Task.projectId` |
| **PERF-04** | `GET /chat/messages` (50 of 5000) | p95 < 200 ms | P1 | Covered by composite index on `(projectId, sentAt DESC)` |
| **PERF-05** | WebSocket concurrency (50 sockets per room) | Stable broadcast < 50ms latency | P1 | Socket.io room broadcasting with minimal payload memory footprint |
| **PERF-06** | Database Index Verification | `EXPLAIN ANALYZE` index scan confirmation | P1 | Documented below |

---

## 2. Database Index Verification (EXPLAIN ANALYZE)

Verify the presence and effectiveness of required indexes in PostgreSQL:

1. **`SkillTag.userId` and `SkillTag.skillName`**:
   ```sql
   EXPLAIN ANALYZE SELECT * FROM "SkillTag" WHERE "userId" = '...' AND "skillName" = 'React';
   -- Expected: Index Scan using "SkillTag_userId_idx" / "SkillTag_userId_skillName_key"
   ```

2. **`Task.projectId`**:
   ```sql
   EXPLAIN ANALYZE SELECT * FROM "Task" WHERE "projectId" = '...' ORDER BY "position" ASC;
   -- Expected: Index Scan using "Task_projectId_idx"
   ```

3. **`Message(projectId, sentAt)`**:
   ```sql
   EXPLAIN ANALYZE SELECT * FROM "Message" WHERE "projectId" = '...' ORDER BY "sentAt" DESC LIMIT 50;
   -- Expected: Backward Index Scan using "Message_projectId_sentAt_idx"
   ```

4. **`ProjectMember(projectId, userId)`**:
   ```sql
   EXPLAIN ANALYZE SELECT * FROM "ProjectMember" WHERE "projectId" = '...' AND "userId" = '...';
   -- Expected: Index Scan using "ProjectMember_projectId_userId_key"
   ```

---

## 3. Resilience & Outage Scenarios

| ID | Scenario | Verification Steps & Expected Recovery Behavior | Priority |
|---|---|---|---|
| **RES-01** | Database crash mid-request | Terminate PostgreSQL container (`docker stop <container>`). API returns clean 503 / 500 JSON without leaking database connection strings or stack traces. On container restart (`docker start`), connection pool reconnects automatically without requiring API process restart. | P1 |
| **RES-02** | API restart during active chat | Gracefully restart NestJS backend. Connected Socket.io clients receive disconnect event, display reconnecting banner, retry connection with exponential backoff, and automatically re-join the room upon reconnect. | P0 |
| **RES-03** | External service failure (LLM / GitHub / Expo) | Simulate network failure to Gemini API, GitHub API, and Expo push servers. Core capabilities (Auth, Kanban, Workspace, Tasks, Chat) continue operating normally without blocking or crashing. GitHub falls back to cached stats or friendly warning; AI Idea Hub returns user-friendly fallback. | P0 |
| **RES-04** | Missing environment configuration | Startup without `JWT_ACCESS_SECRET` or `DATABASE_URL` halts execution immediately during bootstrapping with an explicit fatal log message instead of starting in a compromised state. | P1 |

---

## 4. Manual Security Audit (SEC-07 - SEC-13)

- **SEC-07**: `.env` and `.env.test` are git-ignored. Secret scanning (`gitleaks detect`) verifies zero private credentials or tokens committed in repository history.
- **SEC-08**: Security middleware (`helmet`) is registered on the HTTP server, and CORS is restricted to trusted mobile origins.
- **SEC-10**: `npm audit --omit=dev` verifies 0 high or critical vulnerabilities in production dependencies.
- **SEC-13**: Rate limiting is configured on `/auth/login` to prevent credential stuffing attacks.

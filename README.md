# TeamUp 🚀

> **Project Partner Finder & Team Collaboration Platform**

---

## Introduction
**TeamUp** is an all-in-one platform built to streamline the entire university project lifecycle. It bridges the gap between discovering compatible project teammates and managing day-to-day team execution in a unified, dedicated workspace.

---

## The Problem
Students often face friction when forming teams and executing university projects:
- **Random & Skill-Blind Matching**: Team formation is usually unorganized, leading to unbalanced teams with mismatched skills and conflicting schedules.
- **Fragmented Tooling**: Once formed, teams juggle 3–4 disconnected applications (e.g., WhatsApp for chat, Google Drive for files, notebooks or Trello for tasks, and email for meeting coordination).
- **Lack of Accountability**: Without a centralized source of truth, tracking progress, coordinating meeting availability, and conducting fair peer evaluations becomes difficult.

---

## The Solution
TeamUp provides a unified ecosystem that covers every phase of team collaboration:
1. **Smart Discovery & Matching**: Profiles with verified skill tags, experience levels, availability, and proxied GitHub contribution stats, paired with an explainable weighted matching engine.
2. **Project Marketplace & Idea Hub**: Browse and filter existing project listings or brainstorm new ideas using an integrated AI Idea Generator.
3. **Dedicated Team Workspace**: An in-app collaborative hub containing:
   - **Kanban Board**: Real-time task tracking with lifecycle stages (`TODO` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `TESTING` $\rightarrow$ `DONE`).
   - **Real-Time Team Chat**: Low-latency project room messaging powered by Socket.IO.
   - **File Sharing**: Centralized file attachments and project resource storage.
   - **Meeting Scheduler & Calendar**: Propose meeting slots, collect member votes, auto-confirm slots, and sync project deadlines.
4. **Peer Evaluation & Analytics**: End-of-semester teammate reviews and visual progress analytics.

---

## System Architecture

TeamUp adopts a **Modular Monolith** architecture: a single NestJS backend managing modular feature domains, backed by a PostgreSQL database, Prisma ORM, and a Socket.IO WebSocket gateway.

```mermaid
graph TB
    subgraph Client["React Native App (Expo)"]
        A1["Profile & Auth"]
        A2["Marketplace & Idea Hub"]
        A3["Workspace: Kanban, Chat, Files"]
        A4["Calendar & Scheduler"]
        A5["Analytics & Evaluation"]
    end

    subgraph Backend["NestJS Monolith (Port 3000)"]
        B1["Auth Module"]
        B2["Profile Module"]
        B3["Matching Module"]
        B4["Marketplace Module"]
        B5["Workspace Module (Kanban/Files)"]
        B6["Chat Gateway (WebSocket)"]
        B7["Scheduler Module"]
        B8["Evaluation Module"]
        B9["Analytics Module"]
        B10["AI Idea Module"]
        B11["Notification Module"]
    end

    DB[("PostgreSQL")]
    S3["File Storage (S3)"]
    GH["GitHub API"]
    LLM["LLM API (Idea Generator)"]

    Client -->|"REST & WebSocket (/api/v1)"| Backend
    B1 --> DB
    B2 --> DB
    B2 -.-> GH
    B3 --> DB
    B4 --> DB
    B5 --> DB
    B5 --> S3
    B6 --> DB
    B7 --> DB
    B8 --> DB
    B9 --> DB
    B10 -.-> LLM
    B11 --> DB
```

### Standard API Response Envelope
All REST API endpoints are prefixed with `/api/v1` and return standardized responses:

- **Success Envelope:**
  ```json
  { "success": true, "data": { ... } }
  ```
- **Error Envelope:**
  ```json
  { "success": false, "error": { "code": "ERROR_CODE", "message": "Human-readable description" } }
  ```

---

## Tech Stack

| Domain | Technology | Purpose |
|---|---|---|
| **Backend Framework** | [NestJS](https://nestjs.com/) (TypeScript) | Modular monolith architecture, dependency injection, global interceptors & filters |
| **Database** | [PostgreSQL](https://www.postgresql.org/) | Relational database for profiles, projects, tasks, meetings, and messages |
| **ORM** | [Prisma](https://www.prisma.io/) | Type-safe queries, schema modeling, and automated database migrations |
| **Authentication** | [Passport.js](https://www.passportjs.org/) + JWT | Access token + refresh token rotation with role-based guards |
| **Real-Time Communication** | [Socket.IO](https://socket.io/) (`@nestjs/websockets`) | WebSocket gateway for live room chat, task state sync, and notifications |
| **Mobile Client** | [React Native](https://reactnative.dev/) (Expo) | Cross-platform mobile client for iOS and Android |
| **AI Integration** | LLM API | AI Idea Generator with structured JSON responses and query caching |
| **External APIs** | GitHub REST API, Expo Push | Proxied repository stats and push notifications |

---

## 🤝 Guidelines to Contribute

To ensure smooth integration across backend and frontend slices, all contributors must adhere to these conventions:

### 1. Git Workflow & Branch Naming
- Create feature branches using the format: `feature/<owner>/<feature-name>`  
  *(e.g., `feature/matching-engine`, `feature/kanban-ui`)*.
- Keep pull requests focused on a single feature for straightforward review.

### 2. API Contract & Validation
- Never return bare objects or arrays from controllers — always rely on the global transform interceptor or throw standard NestJS `HttpException`s.
- Always validate incoming request payloads using DTO classes decorated with `class-validator` (e.g., `@IsString()`, `@IsEmail()`, `@IsNotEmpty()`).

### 3. Definition of Done (DoD)
A feature is considered complete when:
1. Endpoints are implemented and adhere to the standard envelope format (`/api/v1`).
2. Input is strictly validated with DTOs, returning `VALIDATION_ERROR` on invalid payloads.
3. Relevant unit tests or E2E tests are written and passing (`npm run test`, `npm run test:e2e`).
4. Mobile screens are wired to live endpoints and handle loading, success, and error states.

---

## Environment Configuration

### 1. Setup `.env`
Copy the shared template to create your local server environment file:
```bash
cp .env.example server/.env
```

### 2. Environment Variables Contract

| Variable | Required By | Description | Example |
|---|---|---|---|
| `PORT` | Backend | Port number for NestJS API server | `3000` |
| `DATABASE_URL` | Backend / Prisma | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/teamup?schema=public` |
| `JWT_SECRET` | Backend (Auth) | Secret key for signing short-lived access JWTs | `your_jwt_access_secret` |
| `JWT_REFRESH_SECRET` | Backend (Auth) | Secret key for signing refresh JWTs | `your_jwt_refresh_secret` |
| `GITHUB_CLIENT_ID` | Backend (Profiles) | GitHub OAuth application client ID | `your_github_client_id` |
| `GITHUB_CLIENT_SECRET` | Backend (Profiles) | GitHub OAuth application client secret | `your_github_client_secret` |
| `LLM_API_KEY` | Backend (AI Ideas) | API key for LLM brainstorming queries | `your_llm_api_key` |
| `EXPO_PUSH_TOKEN_ENDPOINT` | Backend (Notifications)| Expo push notification endpoint | `https://exp.host/--/api/v2/push/send` |
| `UPLOAD_DIR` | Backend (Files) | Local storage directory for uploaded files | `./uploads` |
| `WEBSOCKET_CORS_ORIGIN` | Backend (Chat) | Allowed origins for Socket.IO | `*` |

---

## 🏃 Running the Application (Local Development & Demo)

> **Note:** This project runs entirely locally for development, testing, and defense demos (no live cloud deployment required).

### 1. Install Dependencies
```bash
cd server
npm install
```

### 2. Start the Server
```bash
# Development mode with hot-reload
npm run start:dev
```
- API Base URL: `http://localhost:3000/api/v1`
- Health Check: `http://localhost:3000/api/v1/health`

### 3. Run Tests
```bash
# Run unit tests
npm run test

# Run end-to-end (e2e) tests
npm run test:e2e
```

# OpsPilot AI

AI-powered internal support and operations automation platform.

OpsPilot AI is a production-style full-stack TypeScript project that demonstrates how to build a secure, observable internal support platform with AI-assisted workflows, background processing, and realtime updates.

## Product Overview
OpsPilot AI helps teams manage internal support requests with clear ownership, auditability, and automation.

## Problem Statement
Internal support operations are often fragmented across chat, spreadsheets, and email. This creates slow triage, weak visibility, and inconsistent resolution quality.

## Target Users
- `USER`: create and track own tickets
- `SUPPORT_AGENT`: triage, assign, and resolve tickets
- `ADMIN`: full governance, configuration, and oversight

## Key Features
- JWT authentication and RBAC (`USER`, `SUPPORT_AGENT`, `ADMIN`)
- Ticket workflow: create, assign, reprioritize, update status, resolve/reject
- Audit logging for auth, ticket, AI, knowledge base, and jobs lifecycle
- AI provider abstraction with safe default `mock` mode
- Optional OpenAI-compatible provider (not required for local/CI)
- Knowledge Base CRUD with publish/archive lifecycle
- Deterministic chunking and RAG-style retrieval context
- BullMQ background jobs for ticket AI analysis and KB rechunking
- Worker process with persisted job tracking (`BackgroundJob`)
- Socket.IO realtime updates with JWT socket auth
- Redis pub/sub bridge between API and worker for realtime delivery
- Polling fallback preserved for reliability
- Request IDs, structured logs, global normalized error responses
- Security headers, CORS validation, and route-level rate limiting

## Tech Stack
- Backend: NestJS, TypeScript, Prisma, PostgreSQL, Redis, BullMQ, Socket.IO
- Frontend: Next.js App Router, React, TypeScript
- Testing: Jest + Supertest, Playwright E2E
- Docs/API: Swagger OpenAPI
- Infra: Docker Compose

## Architecture Overview
- `apps/api`: NestJS API, auth/RBAC, tickets, AI, knowledge base, jobs, realtime
- `apps/web`: Next.js frontend for auth, dashboard, tickets, KB management
- `apps/api/src/worker.ts`: dedicated BullMQ worker bootstrap
- `infra/docker-compose.yml`: `postgres`, `redis`, `api`, `worker`, `web`

## Main Workflow
1. User logs in and creates a support ticket.
2. Support agent/admin reviews ticket queue.
3. Ticket gets assigned, updated, and resolved/rejected.
4. Every critical action is audited and observable.

## AI and RAG Workflow
1. Ticket AI analysis is triggered from ticket detail.
2. Relevant published knowledge chunks are retrieved deterministically.
3. Provider returns category, priority, summary, confidence, and recommendation.
4. Ticket AI fields and context sources are persisted safely.

## Background Jobs Workflow
1. In `QUEUE_MODE=async`, AI analysis and rechunk requests are queued.
2. Worker processes jobs via BullMQ.
3. `BackgroundJob` tracks lifecycle: `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`.
4. UI uses realtime events with polling fallback for final consistency.

## Realtime Workflow
1. Frontend connects to Socket.IO with JWT access token.
2. API validates socket auth and grants room access by role/ownership.
3. API/worker publish events through Redis pub/sub bridge.
4. Clients receive ticket/job updates without manual refresh.

## Security and Observability Highlights
- Request ID correlation via `X-Request-ID`
- Structured JSON logs for HTTP, jobs, worker, and realtime events
- Global normalized error response shape including `requestId`
- `GET /api/ready` and `GET /api/system/info` for safe runtime checks
- Route-level rate limiting on auth, AI analysis, and KB search endpoints
- Security headers and validated CORS origin lists
- No secrets in repository, logs, or public API payloads

## Screenshots (Placeholders)
Add real screenshots before publishing portfolio links:
- Dashboard: [docs/screenshots/README.md](docs/screenshots/README.md)
- Tickets list: [docs/screenshots/README.md](docs/screenshots/README.md)
- Ticket detail with AI analysis: [docs/screenshots/README.md](docs/screenshots/README.md)
- Knowledge base pages: [docs/screenshots/README.md](docs/screenshots/README.md)
- Job processing status: [docs/screenshots/README.md](docs/screenshots/README.md)
- Realtime updates in UI: [docs/screenshots/README.md](docs/screenshots/README.md)
- Swagger API docs: [docs/screenshots/README.md](docs/screenshots/README.md)

## Demo Credentials
Seed includes:
- `admin@example.com` / `Password123!`
- `agent@example.com` / `Password123!`
- `user@example.com` / `Password123!`

Seed command:
```bash
npm run prisma:seed -w @opspilot/api
```

## Quick Start (Docker)
```bash
docker compose -f infra/docker-compose.yml up -d --build postgres redis api worker web
```

Run migration/db sync:
```bash
docker compose -f infra/docker-compose.yml exec api npm run prisma:migrate
```

Run seed:
```bash
docker compose -f infra/docker-compose.yml exec api npm run prisma:seed
```

Useful runtime commands:
```bash
docker compose -f infra/docker-compose.yml ps
docker compose -f infra/docker-compose.yml logs -f worker
```

## Local Development
```bash
npm install
npm run prisma:generate -w @opspilot/api
npm run prisma:migrate -w @opspilot/api
npm run prisma:seed -w @opspilot/api
npm run start:dev -w @opspilot/api
npm run worker:dev -w @opspilot/api
npm run dev -w @opspilot/web
```

## URLs
- Frontend: `http://localhost:3000`
- API: `http://localhost:4000/api`
- Swagger: `http://localhost:4000/api/docs`

Worker command:
```bash
npm run worker -w @opspilot/api
```

## Environment Variables
Use `.env.example` as template.

Core:
- `NODE_ENV`
- `PORT`
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `CORS_ORIGIN`
- `NEXT_PUBLIC_API_BASE_URL`

AI:
- `AI_PROVIDER`
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`
- `OPENAI_TIMEOUT_SECONDS`
- `OPENAI_MAX_RETRIES`

Jobs and realtime:
- `QUEUE_MODE`
- `BULLMQ_REDIS_URL`
- `BULLMQ_DEFAULT_ATTEMPTS`
- `BULLMQ_BACKOFF_MS`
- `REALTIME_ENABLED`
- `SOCKET_CORS_ORIGIN`

## Mock AI Mode (Default)
- `AI_PROVIDER=mock`
- No external AI key required
- Deterministic behavior for local development and CI

## OpenAI-Compatible Mode (Optional)
- `AI_PROVIDER=openai`
- Requires `OPENAI_API_KEY`
- Supports `OPENAI_BASE_URL` and configurable model/timeout/retries
- Not required for tests, CI, or demo mode

## Test Commands
```bash
npm run prisma:generate -w @opspilot/api
npm run test -w @opspilot/api
npm run lint -w @opspilot/api
npm run build -w @opspilot/api
npm run build -w @opspilot/web
docker compose -f infra/docker-compose.yml config
```

## Playwright E2E
Playwright test requires a running live stack.

Start stack first:
```bash
docker compose -f infra/docker-compose.yml up -d --build postgres redis api worker web
```

Then run:
```bash
npm run test:e2e -w @opspilot/web
```

## Known Limitations
- Current rate limiting is in-memory and per-process.
- Frontend auth token is stored in `localStorage` for demo simplicity.
- Realtime does not implement replay/acknowledgment guarantees.
- Retrieval is deterministic keyword scoring (no vector DB yet).
- OpenAI mode is optional and not exercised in CI.
- Production deployment should enforce HTTPS and distributed rate limiting.

## Roadmap
- `v1.0.0`: completed MVP with AI-assisted support automation, jobs, and realtime
- Next iterations: production telemetry stack, distributed rate limit store, deployment runbooks, advanced retrieval quality improvements

## GitHub Metadata Suggestions
Suggested repository description:

AI-powered internal support and operations automation platform with NestJS, Next.js, PostgreSQL, Redis, BullMQ, Socket.IO, RBAC, audit logs, RAG-style retrieval and OpenAI-compatible provider support.

Suggested topics:
- `nestjs`
- `nodejs`
- `typescript`
- `nextjs`
- `postgresql`
- `prisma`
- `redis`
- `bullmq`
- `socketio`
- `ai`
- `rag`
- `automation`
- `support-automation`
- `workflow-automation`
- `docker`
- `fullstack`

## Portfolio Summary
OpsPilot AI demonstrates end-to-end full-stack ownership: clean NestJS modular architecture, secure auth/RBAC, resilient async processing, realtime UX with fallback, safe AI provider abstraction, deterministic RAG-style retrieval, Dockerized runtime, and professional test/documentation discipline suitable for employer-facing portfolio review.

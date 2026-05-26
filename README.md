# OpsPilot AI

AI-powered internal support and operations automation platform.

OpsPilot AI is a production-style TypeScript portfolio project focused on backend architecture, full-stack delivery, safe AI automation, and production-readiness hardening.

## Problem Statement
Internal support operations are often fragmented across chat, email, and spreadsheets. OpsPilot AI centralizes request intake, role-based workflow, auditable lifecycle updates, AI-assisted ticket handling, and operational observability.

## Target Users
- `USER`: creates and tracks own support tickets
- `SUPPORT_AGENT`: triages, assigns, and resolves ticket queues
- `ADMIN`: full operational access, governance, and knowledge base control

## Tech Stack
- Backend: NestJS, TypeScript, Prisma, PostgreSQL, Redis, JWT, RBAC, Swagger, Jest
- Frontend: Next.js App Router, React, TypeScript
- Infra: Docker Compose, BullMQ worker, Socket.IO realtime, Redis pub/sub bridge
- Testing: API e2e (Jest + Supertest), browser E2E (Playwright)

## Current Scope (Phase 7)
- Ticket lifecycle workflow (create, assign, status, priority, update)
- Knowledge Base CRUD + deterministic chunking and retrieval
- AI provider abstraction:
  - default deterministic `mock` provider
  - optional OpenAI-compatible provider
- RAG-style ticket AI analysis with KB context sources
- BullMQ async jobs + worker process + persisted `BackgroundJob` status
- Socket.IO realtime updates with JWT auth and room-based permissions
- Polling fallback preserved for job/ticket UI reliability
- Observability and security hardening:
  - request ID middleware (`X-Request-ID`)
  - structured JSON logs for API and worker lifecycle
  - global safe error response format with `requestId`
  - improved readiness/system health endpoints
  - endpoint-level rate limiting on sensitive routes
  - security headers and stricter CORS origin validation
  - audit metadata enrichment with `requestId`

Not included yet:
- LangChain
- vector database/pgvector
- WebSocket presence/collaborative editing

## API URLs
- API base: `http://localhost:4000/api`
- Swagger: `http://localhost:4000/api/docs`
- Web app: `http://localhost:3000`

Detailed endpoints: [docs/API.md](docs/API.md)

## Demo Users
Run seed:
```bash
npm run prisma:seed -w @opspilot/api
```

Credentials (all users):
- password: `Password123!`
- `admin@example.com` (`ADMIN`)
- `agent@example.com` (`SUPPORT_AGENT`)
- `user@example.com` (`USER`)

## Environment Variables
Copy `.env.example`.

Core:
- `NODE_ENV`
- `PORT`
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `CORS_ORIGIN` (supports comma-separated origins)
- `NEXT_PUBLIC_API_BASE_URL`

AI:
- `AI_PROVIDER` (`mock` default, or `openai`)
- `OPENAI_API_KEY` (required only in `openai` mode)
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`
- `OPENAI_TIMEOUT_SECONDS`
- `OPENAI_MAX_RETRIES`

Jobs:
- `QUEUE_MODE` (`async` default, `sync` fallback)
- `BULLMQ_REDIS_URL`
- `BULLMQ_DEFAULT_ATTEMPTS`
- `BULLMQ_BACKOFF_MS`

Realtime:
- `REALTIME_ENABLED` (`true` default)
- `SOCKET_CORS_ORIGIN` (supports comma-separated origins)

## Local Setup
```bash
npm install
npm run prisma:generate -w @opspilot/api
npm run prisma:migrate -w @opspilot/api
npm run prisma:seed -w @opspilot/api
```

Run API:
```bash
npm run start:dev -w @opspilot/api
```

Run worker:
```bash
npm run worker:dev -w @opspilot/api
```

Run web:
```bash
npm run dev -w @opspilot/web
```

Run both API + web:
```bash
npm run dev
```

## Docker Setup
```bash
docker compose -f infra/docker-compose.yml up --build
```

Stop:
```bash
docker compose -f infra/docker-compose.yml down
```

## Validation Commands
```bash
npm run prisma:generate -w @opspilot/api
npm run test -w @opspilot/api
npm run lint -w @opspilot/api
npm run build -w @opspilot/api
npm run build -w @opspilot/web
docker compose -f infra/docker-compose.yml config
```

Optional browser E2E:
```bash
npm run test:e2e -w @opspilot/web
```

## API Error Format (Phase 7)
Errors are normalized to:
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "path": "/api/auth/register",
  "timestamp": "2026-05-26T12:00:00.000Z",
  "requestId": "uuid-or-client-value"
}
```

## Architecture Docs
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/API.md](docs/API.md)
- [docs/JOBS.md](docs/JOBS.md)
- [docs/REALTIME.md](docs/REALTIME.md)
- [docs/RAG.md](docs/RAG.md)
- [docs/SECURITY.md](docs/SECURITY.md)
- [docs/OBSERVABILITY.md](docs/OBSERVABILITY.md)
- [docs/ROADMAP.md](docs/ROADMAP.md)

## Portfolio Summary
Phase 7 makes the platform production-readiness oriented: request correlation, safer error handling, validated CORS/security headers, route throttling, stronger readiness insight, and better job/realtime observability while preserving existing architecture and polling fallback.

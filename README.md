# OpsPilot AI

AI-powered internal support and operations automation platform.

OpsPilot AI is a production-style TypeScript portfolio project focused on backend architecture, practical full-stack implementation, and safe AI automation patterns.

## Problem Statement
Internal support operations are often fragmented across chat, email, and spreadsheets. OpsPilot AI centralizes request intake, role-based workflow, auditable changes, and AI-assisted ticket analysis.

## Target Users
- `USER`: creates and tracks own support tickets
- `SUPPORT_AGENT`: triages, assigns, and resolves ticket queues
- `ADMIN`: full operational access, governance, and knowledge base control

## Tech Stack
- Backend: NestJS, TypeScript, Prisma, PostgreSQL, JWT, RBAC, Swagger, Jest
- Frontend: Next.js App Router, React, TypeScript
- Infra: Docker Compose, Redis readiness
- Testing: API e2e (Jest + Supertest), browser E2E (Playwright)

## Current Scope (Phase 5)
- Ticket lifecycle workflow (create, assign, status, priority, update)
- Audit logging for auth, ticket lifecycle, AI, and knowledge base events
- AI provider abstraction:
  - default deterministic `mock` provider
  - optional OpenAI-compatible provider
- Knowledge Base module:
  - CRUD + publish/archive/rechunk lifecycle
  - deterministic chunking
  - deterministic retrieval/search
- Simple RAG-like AI flow:
  - ticket AI analysis retrieves relevant published KB chunks
  - context sources are returned and stored on ticket
- Background jobs with BullMQ:
  - async ticket AI analysis queue + worker processing
  - async knowledge base rechunk queue + worker processing
  - persisted background job status tracking
  - sync fallback mode for deterministic tests/local fallback
- Frontend wiring:
  - auth, tickets, ticket detail AI actions
  - knowledge base list/new/detail pages

Not included yet:
- LangChain
- full RAG/vector DB stack
- WebSockets

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
- `CORS_ORIGIN`
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

Run both:
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

## Browser E2E
Start required stack:
```bash
docker compose -f infra/docker-compose.yml up -d --build postgres redis api worker web
```

Run migrations/seed if needed:
```bash
docker compose -f infra/docker-compose.yml exec api npm run prisma:migrate
docker compose -f infra/docker-compose.yml exec api npm run prisma:seed
```

Run E2E:
```bash
npm run test:e2e -w @opspilot/web
```

## Async Job Flow
In `QUEUE_MODE=async`:
- `POST /tickets/:id/ai/analyze` enqueues a job and returns `jobId`
- `POST /knowledge-base/articles/:id/rechunk` enqueues a job and returns `jobId`
- use `GET /jobs/:id` (or `GET /jobs/tickets/:ticketId`) for status polling

In `QUEUE_MODE=sync`:
- analysis/rechunk are performed immediately in the API process

## Architecture Docs
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/RAG.md](docs/RAG.md)
- [docs/JOBS.md](docs/JOBS.md)
- [docs/ROADMAP.md](docs/ROADMAP.md)

## Portfolio Summary
Phase 5 adds production-style async orchestration with BullMQ workers, retry/backoff handling, and auditable job state tracking while preserving deterministic mock AI behavior.

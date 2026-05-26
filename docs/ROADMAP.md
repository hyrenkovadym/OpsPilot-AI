# OpsPilot AI Roadmap

## Phase 1 (Completed)
- Monorepo setup (API + web)
- Core NestJS modules
- Prisma schema baseline
- JWT + RBAC foundation
- Ticket and audit baseline
- Docker and CI foundation

## Phase 2 (Completed)
- Ticket lifecycle workflow
- Filtering and pagination
- Role-enforced visibility rules
- Frontend API wiring for auth/tickets

## Phase 3 (Completed)
- AI provider abstraction
- Deterministic mock AI default
- Optional OpenAI-compatible provider
- Ticket AI analyze/suggestion endpoints
- Safe AI fallback and audit events

## Phase 4 (Completed)
- Knowledge base module with CRUD lifecycle
- Article chunking and deterministic retrieval
- RAG-style context injection into ticket AI analysis
- Context sources persisted and returned

## Phase 5 (Completed)
- BullMQ background jobs
- Worker runtime and Docker worker service
- Async ticket AI analysis and KB rechunking
- Background job status endpoints and polling UX

## Phase 6 (Completed)
- Socket.IO realtime updates
- JWT-authenticated socket connections
- Role-aware room subscriptions
- Redis pub/sub bridge between API and worker
- Frontend realtime hints with polling fallback preserved

## Phase 7 (Completed)
- Request ID middleware (`X-Request-ID`) and propagation
- Structured JSON logs for API and worker lifecycle
- Global safe error response filter with `requestId`
- Improved `/health`, `/ready`, `/system/info`
- Route-level rate limiting for sensitive endpoints
- Security headers and stricter CORS validation
- Audit metadata polish and job observability improvements

## Phase 8 (Next): Final Portfolio Release
- Final docs and architecture diagrams polish
- Deployment and operations runbook
- Security/observability checklist sign-off
- Recruiter/demo walkthrough preparation

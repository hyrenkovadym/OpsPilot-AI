# OpsPilot AI Roadmap

## Phase 1 (Completed)
- Monorepo setup (API + Web)
- Core NestJS modules
- Prisma schema baseline
- JWT + RBAC foundation
- Ticket and audit baseline
- Docker and CI foundation

## Phase 2 (Completed)
- Ticket lifecycle workflow (assign/status/priority/update)
- Filtering and pagination
- Role-enforced visibility rules
- Frontend API wiring for auth/tickets

## Phase 3 (Completed)
- AI provider abstraction
- Deterministic mock AI default
- Optional OpenAI-compatible provider
- Ticket AI analyze/suggestion endpoints
- AI audit events and safe fallback handling

## Phase 4 (Completed)
- Knowledge base module with CRUD and lifecycle actions
- Article chunking and deterministic retrieval
- Simple RAG-like context injection into ticket AI analysis
- Context sources persisted and returned in AI responses
- Frontend knowledge base management pages
- Expanded backend tests for permissions, retrieval, and AI context flow

## Phase 5 (Completed): BullMQ Background Jobs
- Async ticket analysis jobs
- Async knowledge base rechunk jobs
- Retry/backoff handling
- Worker runtime + Docker worker service
- Background job status endpoints and polling-ready frontend UX

## Phase 6 (Completed): Socket.IO Real-Time Updates
- Real-time ticket status/assignment updates
- Live queue refresh for support views
- Authenticated event channels
- Worker-safe event delivery through Redis pub/sub bridge
- Frontend live updates with polling fallback

## Phase 7 (Next): Observability and Security Hardening
- Structured logs and trace correlation
- Metrics and alerting
- Security polish (rate limiting, session/token hardening, policy docs)

## Phase 8: Final Portfolio Release
- UX/docs polish
- deployment guide
- architecture diagrams
- recruiter-facing walkthrough demo

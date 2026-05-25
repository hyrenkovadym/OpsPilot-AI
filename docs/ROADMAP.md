# OpsPilot AI Roadmap

## Phase 1 (Completed)
- Monorepo foundation
- NestJS API baseline
- Prisma/PostgreSQL schema
- Redis-ready config
- JWT auth and RBAC foundation
- Ticket module baseline
- Audit logging baseline
- Docker Compose and CI
- Next.js frontend skeleton

## Phase 2 (Completed)
- Ticket lifecycle endpoints:
  - status updates
  - ticket assignment
  - priority updates
  - general ticket patch updates
- Ticket queue filtering and pagination
- Role-aware permission enforcement for USER/SUPPORT_AGENT/ADMIN
- Expanded lifecycle audit events
- Seeded demo users and sample tickets
- Frontend pages wired to backend API

## Phase 3 (Completed): AI Provider Abstraction
- Added provider-agnostic AI interfaces and service contracts
- Implemented deterministic mock provider as default
- Added optional OpenAI-compatible provider (config-driven)
- Added ticket AI analysis and suggestion endpoints
- Added AI audit events and safe failure handling

## Phase 4 (Next): Knowledge Base and Simple RAG
- Add knowledge base entities and CRUD endpoints
- Build lightweight retrieval layer for ticket-assist context
- Return response citations/source snippets
- Keep architecture simple and testable

## Phase 5: BullMQ Background Jobs
- Introduce async job processing for AI and operational tasks
- Queue retries and failure handling
- Job observability and operational controls

## Phase 6: Socket.IO Real-Time Updates
- Real-time ticket state updates for dashboard and queue views
- Assignment/status notification events
- Connection-level auth and authorization checks

## Phase 7: Observability, Audit, and Security Polish
- Structured logging and request tracing
- Operational metrics and alerting
- Security hardening (rate limiting, auth/session policies, secret handling docs)

## Phase 8: Final Portfolio Release
- UX and documentation polish
- End-to-end demo scenarios
- deployment guide and architecture diagrams
- recruiter-facing walkthrough narrative


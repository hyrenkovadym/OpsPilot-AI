# OpsPilot AI Architecture (Phase 7)

## Monorepo
- `apps/api`: NestJS backend
- `apps/web`: Next.js frontend
- `infra`: Docker Compose
- `docs`: architecture/API/roadmap/security/observability

## Backend Modules
- `config`: env loading + validation
- `prisma`: database access
- `auth`: register/login/me with JWT
- `users`: user lookup helpers
- `tickets`: workflow + AI endpoints
- `ai`: provider abstraction (`mock`, optional `openai`)
- `knowledge-base`: article CRUD, chunking, retrieval
- `jobs`: queue orchestration + status APIs
- `workers`: BullMQ processors
- `realtime`: Socket.IO gateway + Redis pub/sub bridge
- `audit`: centralized audit events
- `health`: health/readiness/system endpoints
- `common`: guards, decorators, request context, filters, middleware

## Data Layer
Core models:
- `User`
- `RefreshToken`
- `Ticket`
- `AuditLog`

Knowledge models:
- `KnowledgeBaseArticle`
- `KnowledgeBaseChunk`

Jobs:
- `BackgroundJob`

Ticket AI fields:
- `aiSummary`
- `aiConfidence`
- `aiRecommendedAction`
- `aiContextSourcesJson`

## Request Lifecycle Hardening (Phase 7)
1. `RequestIdMiddleware`
- reads `X-Request-ID`
- generates if missing
- sets response `X-Request-ID`
- stores request context via AsyncLocalStorage

2. `RequestLoggingMiddleware`
- emits structured JSON logs on request completion
- includes requestId, method, path, status, duration, userId (if available)

3. `GlobalHttpExceptionFilter`
- normalizes error shape
- includes requestId/path/timestamp/status
- hides internal stack traces in responses

## Auth and RBAC
- `JwtAuthGuard` validates access token
- `RolesGuard` enforces role policies
- service-level ownership checks enforce record visibility

Role highlights:
- `USER`: own tickets + published KB visibility
- `SUPPORT_AGENT`: queue operations + KB management
- `ADMIN`: full platform access

## Knowledge and Retrieval
- deterministic chunking (~800 chars)
- deterministic retrieval scoring (keywords/title/category boosts)
- only `PUBLISHED` articles are used for AI context

## Queue Architecture
Queues:
- `ticket-ai`
- `knowledge-base`

Jobs:
- `analyze-ticket`
- `rechunk-article`

Modes:
- `QUEUE_MODE=async` (default)
- `QUEUE_MODE=sync` fallback

`BackgroundJob` provides operational visibility:
- status, attempts, timing metadata, safe failure reason

## Realtime Architecture
- API hosts Socket.IO gateway
- worker/API publish realtime envelopes via Redis channel
- API subscribes and emits to rooms

Rooms:
- `support:all`
- `admin:all`
- `user:{userId}`
- `ticket:{ticketId}`
- `job:{jobId}`

Polling fallback remains enabled in frontend for reliability.

## Health, Readiness, System
- `/api/health`: lightweight liveness
- `/api/ready`: DB/Redis/queue/realtime/AI readiness summary
- `/api/system/info`: safe runtime metadata only

## Security Controls (Phase 7)
- route-level rate limiting on auth + AI analyze + KB search
- security headers middleware
- strict CORS origin validation (comma-separated origins supported)
- requestId propagation into audit metadata
- safe logs and payload discipline (no secrets/tokens/keys)

## Forward Path
Phase 8 will focus on final portfolio release preparation: docs polish, deployment guide, walkthrough assets, and final hardening checklist.

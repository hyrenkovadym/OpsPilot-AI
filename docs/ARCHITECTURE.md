# OpsPilot AI Architecture (Phase 6)

## Monorepo
- `apps/api`: NestJS backend
- `apps/web`: Next.js frontend
- `infra`: Docker Compose
- `docs`: architecture/API/roadmap/RAG notes

## Backend Modules
- `config`: env loading + validation
- `prisma`: database layer
- `auth`: register/login/me with JWT
- `users`: user access helpers
- `tickets`: ticket lifecycle + AI endpoints
- `ai`: provider abstraction (`mock`, optional `openai`)
- `knowledge-base`: article CRUD, chunking, retrieval
- `jobs`: queue orchestration, job records, job status endpoints
- `workers`: BullMQ processors for ticket AI and KB rechunk
- `realtime`: Socket.IO gateway, JWT socket auth, Redis pub/sub bridge
- `audit`: centralized audit log service
- `health`: health/readiness
- `common`: guards, decorators, auth types

## Data Layer

Core models:
- `User`
- `RefreshToken`
- `Ticket`
- `AuditLog`

Knowledge models:
- `KnowledgeBaseArticle`
- `KnowledgeBaseChunk`

Job model:
- `BackgroundJob`

Ticket AI fields:
- `aiSummary`
- `aiConfidence`
- `aiRecommendedAction`
- `aiContextSourcesJson`

## Auth and RBAC
1. `JwtAuthGuard` validates access tokens
2. `RolesGuard` enforces role-based policies
3. Service-level record checks enforce resource ownership rules

Role highlights:
- `USER`: own tickets, published KB visibility
- `SUPPORT_AGENT`: queue ops + KB management
- `ADMIN`: full platform access

## Knowledge Base Lifecycle
Statuses:
- `DRAFT`
- `PUBLISHED`
- `ARCHIVED`

Lifecycle behavior:
- create article as `DRAFT`
- publish/article update triggers chunk lifecycle
- archive retains article but excludes it from retrieval context
- only `PUBLISHED` content is used in ticket AI retrieval

## Chunking Strategy
- Lightweight deterministic chunking by paragraph + size boundary
- default chunk target around 800 chars
- chunk order stored by `chunkIndex`
- rough token estimate stored for each chunk

## Retrieval Strategy (Simple RAG-like)
`RetrievalService` uses deterministic scoring:
- keyword overlap in chunk content
- title boost
- article content match
- category boost

Top chunks are returned with score and source metadata.

No external embedding/vector dependency yet; JSON embedding placeholders are kept for future migration.

## AI Integration Flow
1. Ticket AI analyze endpoint loads ticket
2. Retrieval fetches top published KB chunks for ticket context
3. In `QUEUE_MODE=async`, API creates/enqueues `BackgroundJob`; worker performs processing
4. In `QUEUE_MODE=sync`, API performs processing directly
5. Provider receives ticket + optional context chunks
6. Output is schema-validated
7. Ticket AI fields and context sources are persisted
8. Audit events capture queue/retrieval/analyze/failure paths

Provider behavior:
- `MockAiProvider` default: deterministic, local/test safe
- `OpenAiCompatibleProvider` optional: structured JSON output, retries, timeout, safe error handling

## Frontend Architecture
- API access centralized in `apps/web/lib/api.ts`
- realtime socket helpers centralized in `apps/web/lib/realtime.ts`
- Ticket UI:
  - list/new/detail pages
  - AI analyze action and context display
  - async job polling (`QUEUED`/`PROCESSING`/`COMPLETED`/`FAILED`)
  - realtime event handling with polling fallback
- Knowledge Base UI:
  - `/knowledge-base`
  - `/knowledge-base/new`
  - `/knowledge-base/[id]`
  - async rechunk polling in article detail
  - realtime rechunk progress updates

## Queue Architecture
- Queue names:
  - `ticket-ai`
  - `knowledge-base`
- Job names:
  - `analyze-ticket`
  - `rechunk-article`
- Worker entrypoint:
  - `apps/api/src/worker.ts`
- Runtime modes:
  - `QUEUE_MODE=async` (default)
  - `QUEUE_MODE=sync` (fallback for deterministic tests/local flows)

Retry/backoff configuration:
- `BULLMQ_DEFAULT_ATTEMPTS`
- `BULLMQ_BACKOFF_MS`
- `BULLMQ_REDIS_URL`

## Realtime Architecture
- API process hosts Socket.IO gateway.
- Socket auth validates JWT access token and binds user context.
- Worker process does not host gateway.
- Worker/API emit realtime events through shared `RealtimeService`.
- `RealtimeService` publishes events to Redis channel and API gateway emits to rooms.

Room model:
- global support room: `support:all`
- optional admin room: `admin:all`
- user room: `user:{userId}`
- ticket room: `ticket:{ticketId}`
- job room: `job:{jobId}`

## Security and Reliability
- `AI_PROVIDER=mock` by default; no key required
- tests never require real OpenAI or network for AI validation paths
- API keys never logged or returned in error payloads
- audit metadata stores safe operational context only

## Forward Path
Next planned upgrade is observability/security hardening (Phase 7), then final portfolio release polish.

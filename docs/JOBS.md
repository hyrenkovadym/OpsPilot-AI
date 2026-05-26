# OpsPilot AI Jobs (Phase 6)

## Overview
Phase 5 introduces BullMQ-based background processing for two async workflows:
- ticket AI analysis
- knowledge base article rechunking

The API remains runnable without external AI keys because `AI_PROVIDER=mock` is the default.

## Queue and Worker Design

Queues:
- `ticket-ai`
- `knowledge-base`

Job names:
- `analyze-ticket`
- `rechunk-article`

Worker entrypoint:
- `apps/api/src/worker.ts`

Run worker locally:
```bash
npm run worker:dev -w @opspilot/api
```

Run built worker:
```bash
npm run worker -w @opspilot/api
```

## Queue Mode

- `QUEUE_MODE=async` (default): endpoints enqueue jobs and return quickly with `jobId`
- `QUEUE_MODE=sync`: endpoints execute work immediately in API process

`sync` mode is useful for deterministic tests and fallback scenarios.

## Background Job Persistence

`BackgroundJob` tracks:
- type (`TICKET_AI_ANALYSIS`, `KNOWLEDGE_BASE_RECHUNK`)
- status (`QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`)
- entity metadata (`entityType`, `entityId`)
- attempts, timestamps, and safe failure reason

## API Behavior

Ticket analyze:
- `POST /tickets/:id/ai/analyze`
- async mode: returns queued response
- sync mode: returns analysis response immediately

KB rechunk:
- `POST /knowledge-base/articles/:id/rechunk`
- async mode: returns queued response
- sync mode: returns updated article immediately

Job status:
- `GET /jobs/:id`
- `GET /jobs/tickets/:ticketId`

## Retries and Backoff

Configured by env:
- `BULLMQ_DEFAULT_ATTEMPTS`
- `BULLMQ_BACKOFF_MS`
- `BULLMQ_REDIS_URL`

## Audit and Logging

Queue-related audit events include:
- `ticket_ai_analysis_queued`
- `ticket_ai_analysis_started`
- `ticket_ai_analyzed`
- `ticket_ai_analysis_failed`
- `knowledge_article_rechunk_queued`
- `knowledge_article_rechunk_started`
- `knowledge_article_rechunked`
- `knowledge_article_rechunk_failed`

Logs and audit metadata exclude API keys, secrets, full prompts, and full KB content.

## Realtime Integration

- Jobs publish lifecycle events:
  - `job.queued`
  - `job.processing`
  - `job.completed`
  - `job.failed`
- Domain-specific events:
  - `ticket.ai.queued|processing|completed|failed`
  - `knowledge.rechunk.queued|processing|completed|failed`
- Worker emits events through Redis pub/sub bridge and API gateway forwards to sockets.
- Polling endpoints (`GET /jobs/:id`, `GET /jobs/tickets/:ticketId`) remain available as fallback.

## Docker

`infra/docker-compose.yml` includes:
- `api`
- `worker`
- `postgres`
- `redis`
- `web`

Start stack:
```bash
docker compose -f infra/docker-compose.yml up -d --build postgres redis api worker web
```

## Testing Strategy

- API tests default to `QUEUE_MODE=sync`, avoiding Redis/OpenAI network dependency
- Mock AI provider remains deterministic and default
- Async flows are covered by service-level/endpoint tests using queue mode toggling and controlled mocks

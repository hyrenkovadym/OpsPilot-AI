# OpsPilot AI Jobs (v1.0.0)

## Overview
BullMQ background processing covers:
- ticket AI analysis
- knowledge base article rechunking

The API remains runnable without external AI keys because `AI_PROVIDER=mock` is default.

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
- `QUEUE_MODE=async` (default): enqueue + background processing
- `QUEUE_MODE=sync`: immediate API processing fallback

## Background Job Visibility
`BackgroundJob` tracks:
- `type`
- `status`
- `entityType` + `entityId`
- `attempts`
- `startedAt` / `finishedAt`
- safe `lastError`
- `metadata`

Job API responses include computed `durationMs` when timing data is available.

## API Endpoints
- `POST /tickets/:id/ai/analyze`
- `POST /knowledge-base/articles/:id/rechunk`
- `GET /jobs/:id`
- `GET /jobs/tickets/:ticketId`

## Retry and Backoff
- `BULLMQ_DEFAULT_ATTEMPTS`
- `BULLMQ_BACKOFF_MS`
- `BULLMQ_REDIS_URL`

## Observability (Phase 7)
Structured worker/API logs include safe fields:
- event name
- jobId
- status
- attempts
- durationMs (when available)
- entity identifiers

No secrets/tokens/API keys/prompt raw content are logged.

## Audit Events
Job-related audit events include:
- queue/start/completed/failed lifecycle events for ticket AI and KB rechunk
- safe metadata only (jobId, queueName, status, attempts, short reason)

## Realtime Integration
Worker publishes lifecycle events through Redis pub/sub; API gateway forwards to sockets:
- `job.queued`
- `job.processing`
- `job.completed`
- `job.failed`

Domain-specific mirrors:
- `ticket.ai.*`
- `knowledge.rechunk.*`

Polling endpoints remain fallback when realtime events are delayed or missed.

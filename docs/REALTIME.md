# OpsPilot AI Realtime (Phase 7)

## Overview
Socket.IO realtime delivery runs on top of REST + BullMQ.

Goals:
- stream ticket and job lifecycle updates to clients
- keep existing polling fallback for reliability
- preserve safe payload discipline

## Connection
Socket endpoint:
- `http://localhost:4000`

Client auth:
```ts
io('http://localhost:4000', {
  auth: { token: '<jwt-access-token>' },
});
```

Invalid/missing token is rejected safely.

## Rooms and Access
Server-managed rooms:
- `support:all`
- `admin:all`
- `user:{userId}`
- `ticket:{ticketId}`
- `job:{jobId}`

Client subscription events:
- `subscribe.ticket` / `unsubscribe.ticket`
- `subscribe.job` / `unsubscribe.job`

Permission checks are enforced before joining ticket/job rooms.

## Event Names
Ticket events:
- `ticket.created`
- `ticket.updated`
- `ticket.status.updated`
- `ticket.assigned`
- `ticket.priority.updated`

Job events:
- `job.queued`
- `job.processing`
- `job.completed`
- `job.failed`

Domain job events:
- `ticket.ai.queued`
- `ticket.ai.processing`
- `ticket.ai.completed`
- `ticket.ai.failed`
- `knowledge.rechunk.queued`
- `knowledge.rechunk.processing`
- `knowledge.rechunk.completed`
- `knowledge.rechunk.failed`

Audit stream:
- `audit.created`

## Worker/API Delivery Bridge
- Worker publishes realtime envelopes to Redis channel.
- API subscribes and emits through gateway.
- API-originated events use the same RealtimeService path.

This keeps delivery consistent in separate API/worker processes.

## Security and Safety
Realtime payloads include safe operational fields only:
- ids
- status
- category/priority
- attempts
- timestamps
- short reason/message

Excluded from realtime payloads:
- tokens
- password hashes
- API keys
- stack traces
- full prompts and full KB raw content

## Observability Notes (Phase 7)
Realtime publishing logs structured events with safe metadata.

## Polling Fallback
Polling remains intentionally enabled for:
- ticket AI job tracking
- KB rechunk tracking

Frontend uses realtime to reduce latency and polling as fallback for reconnect/missed-event scenarios.

# OpsPilot AI Realtime (Phase 6)

## Overview
Phase 6 adds Socket.IO realtime delivery on top of the existing REST + BullMQ architecture.

Goals:
- keep existing ticket/job workflow intact
- deliver ticket and job lifecycle updates to connected clients
- preserve polling fallback for reliability

## Connection

Socket endpoint:
- `http://localhost:4000` (same API host/port)

Client auth:
- pass JWT access token in Socket.IO auth payload:
```ts
io('http://localhost:4000', {
  auth: { token: '<access-token>' },
});
```

Invalid or missing token results in safe connection rejection.

## Rooms and Access

Server-managed rooms:
- `support:all`
- `admin:all`
- `user:{userId}`
- `ticket:{ticketId}`
- `job:{jobId}`

Subscription events:
- `subscribe.ticket` / `unsubscribe.ticket`
- `subscribe.job` / `unsubscribe.job`

Permission checks:
- users can subscribe only to tickets/jobs they are allowed to view
- support/admin can subscribe across broader operational scope

## Event Model

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

AI/KB job domain events:
- `ticket.ai.queued`
- `ticket.ai.processing`
- `ticket.ai.completed`
- `ticket.ai.failed`
- `knowledge.rechunk.queued`
- `knowledge.rechunk.processing`
- `knowledge.rechunk.completed`
- `knowledge.rechunk.failed`

Optional audit stream:
- `audit.created`

## Worker/API Delivery Bridge

Because worker and API run as separate processes:
- worker publishes realtime envelopes through Redis pub/sub
- API subscribes to channel and emits to Socket.IO clients
- API-originated events also pass through the same service path

This keeps event delivery consistent across processes.

## Polling Fallback

Polling remains supported and is not removed:
- ticket detail and KB detail still poll job status during async operations
- websocket events can accelerate UX, while polling covers reconnects and missed events

## Safety

Realtime payloads include safe fields only:
- ids, status, category/priority, attempts, timestamps, short messages

Excluded from payloads:
- password hashes
- JWT tokens
- API keys
- stack traces
- full prompts / full KB raw content

## Environment

Required/relevant env:
- `REALTIME_ENABLED=true`
- `SOCKET_CORS_ORIGIN=http://localhost:3000`
- `BULLMQ_REDIS_URL=...` (used by pub/sub bridge)

## Known Limitations

- No WebSocket presence indicators yet
- No per-event acknowledgement/replay layer
- Realtime dashboards use simple refresh hints rather than full client cache sync

# OpsPilot AI API (Phase 7)

Base URL: `http://localhost:4000/api`  
Swagger: `http://localhost:4000/api/docs`

## Health and System
- `GET /health`
- `GET /ready`
- `GET /system/info`

### `GET /ready` includes safe runtime status
- `database`
- `redis`
- `queueMode`
- `realtimeEnabled`
- `aiProvider`

### `GET /system/info` returns safe metadata only
- service/runtime/env metadata
- no secrets, no keys, no private file paths

## Auth
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

## Roles
- `USER`
- `SUPPORT_AGENT`
- `ADMIN`

## Tickets
All ticket endpoints require `Bearer <accessToken>`.

- `POST /tickets`
- `GET /tickets`
- `GET /tickets/:id`
- `PATCH /tickets/:id/status`
- `PATCH /tickets/:id/assign`
- `PATCH /tickets/:id/priority`
- `PATCH /tickets/:id`
- `POST /tickets/:id/ai/analyze`
- `GET /tickets/:id/ai/suggestion`
- `GET /tickets/:id/jobs`

## Knowledge Base
Prefix: `/knowledge-base`

- `POST /knowledge-base/articles`
- `GET /knowledge-base/articles`
- `GET /knowledge-base/articles/:id`
- `PATCH /knowledge-base/articles/:id`
- `DELETE /knowledge-base/articles/:id`
- `POST /knowledge-base/articles/:id/publish`
- `POST /knowledge-base/articles/:id/archive`
- `POST /knowledge-base/articles/:id/rechunk`
- `GET /knowledge-base/search`

## Jobs
All jobs endpoints require `Bearer <accessToken>`.

- `GET /jobs/:id`
- `GET /jobs/tickets/:ticketId`

Job status values:
- `QUEUED`
- `PROCESSING`
- `COMPLETED`
- `FAILED`

`BackgroundJob` response now includes:
- `attempts`
- `startedAt`
- `finishedAt`
- `durationMs`
- safe `lastError`

## Realtime (Socket.IO)
Socket endpoint:
- `http://localhost:4000` (same API host/port)

Auth:
- `auth: { token: "<jwt-access-token>" }`

Room subscription events:
- `subscribe.ticket` / `unsubscribe.ticket`
- `subscribe.job` / `unsubscribe.job`

Server room model:
- `support:all`
- `admin:all`
- `user:{userId}`
- `ticket:{ticketId}`
- `job:{jobId}`

Event names:
- `ticket.created`
- `ticket.updated`
- `ticket.status.updated`
- `ticket.assigned`
- `ticket.priority.updated`
- `job.queued`
- `job.processing`
- `job.completed`
- `job.failed`
- `ticket.ai.queued`
- `ticket.ai.processing`
- `ticket.ai.completed`
- `ticket.ai.failed`
- `knowledge.rechunk.queued`
- `knowledge.rechunk.processing`
- `knowledge.rechunk.completed`
- `knowledge.rechunk.failed`
- `audit.created`

## Rate Limiting (Phase 7)
Route-level limits are applied to:
- `POST /auth/register`
- `POST /auth/login`
- `POST /tickets/:id/ai/analyze`
- `GET /knowledge-base/search`

## Request ID
- Incoming `X-Request-ID` is preserved if valid.
- If missing, API generates one.
- API returns `X-Request-ID` in response headers.
- Error responses include `requestId`.

## Error Response Shape
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "path": "/api/auth/register",
  "timestamp": "2026-05-26T12:00:00.000Z",
  "requestId": "uuid-or-client-value"
}
```

## Security Notes
- Secrets/API keys are never returned by health/system endpoints.
- Realtime payloads exclude token/secret/prompt raw content.
- OpenAI mode remains optional.
- Tests run with `AI_PROVIDER=mock` and no real OpenAI calls.

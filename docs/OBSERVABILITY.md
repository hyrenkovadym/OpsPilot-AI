# OpsPilot AI Observability Notes (v1.0.0)

## Objectives
- correlate requests and async flows end-to-end
- provide safe operational visibility for API, jobs, and realtime
- expose useful liveness/readiness/runtime signals

## Request Correlation
- request context stores `requestId`
- request ID source:
  - incoming `X-Request-ID`
  - generated UUID when missing
- response includes `X-Request-ID`
- error responses include `requestId`
- audit metadata includes `requestId` when available

## Structured Logs
API and worker use structured JSON-style logging for key events.

Common safe fields:
- `timestamp`
- `level`
- `event`
- `requestId` (HTTP)
- `userId` (when safe)
- `ticketId` / `jobId` / `articleId`
- `status`
- `attempts`
- `durationMs` (when available)

Not logged:
- JWT tokens
- API keys
- password hashes
- full prompts
- full KB raw content

## Health and Runtime Endpoints
- `GET /api/health`: liveness
- `GET /api/ready`: dependency/readiness summary
- `GET /api/system/info`: safe runtime metadata only

`/ready` includes:
- database status
- redis status
- queue mode
- realtime enabled flag
- AI provider mode

## Background Job Observability
`BackgroundJob` plus status endpoints provide:
- queue lifecycle state
- attempts
- started/finished timestamps
- safe `lastError`
- computed `durationMs`

Endpoints:
- `GET /api/jobs/:id`
- `GET /api/jobs/tickets/:ticketId`

## Realtime Observability
- lifecycle events published for tickets/jobs/AI/rechunk
- worker-to-API delivery via Redis pub/sub bridge
- API gateway emits to role/ownership-aware rooms

Polling fallback remains enabled to handle reconnects and missed realtime events.

## Known Gaps
- no metrics backend (Prometheus/OpenTelemetry) yet
- no distributed trace exporter yet
- no event replay/ack pipeline yet

## Recommended Phase 8 Upgrades
- OpenTelemetry tracing + metrics export
- log shipping pipeline and dashboards
- alerting rules for failure/error spikes
- SLO/SLA-oriented readiness thresholds

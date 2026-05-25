# OpsPilot AI API (Phase 3)

Base URL: `http://localhost:4000/api`  
Swagger: `http://localhost:4000/api/docs`

## Auth

### POST `/auth/register`
Creates a `USER` account and returns access token.

### POST `/auth/login`
Authenticates user and returns access token.

### GET `/auth/me`
Returns authenticated user profile.

## Health

### GET `/health`
Simple status check.

### GET `/ready`
Readiness check with database verification.

## Tickets

Auth for ticket routes: `Bearer <accessToken>`

### POST `/tickets`
Create ticket.

Roles: `USER`, `SUPPORT_AGENT`, `ADMIN`

### GET `/tickets`
List with filters + pagination.

Roles:
- `USER`: own tickets only
- `SUPPORT_AGENT`, `ADMIN`: all tickets

Query params:
- `status`
- `category`
- `priority`
- `assignedToId`
- `createdById` (ignored in user-scoped mode)
- `search`
- `page` (default `1`)
- `limit` (default `10`)

### GET `/tickets/:id`
Ticket detail response includes:
- `createdBy` summary
- `assignedTo` summary (if assigned)
- `aiSummary`
- `aiConfidence`
- `aiRecommendedAction`

Visibility:
- `USER`: own ticket only
- `SUPPORT_AGENT`, `ADMIN`: any ticket

### PATCH `/tickets/:id/status`
Status update.

Roles:
- `SUPPORT_AGENT`, `ADMIN`: full status updates
- `USER`: own ticket, only to `RESOLVED`

### PATCH `/tickets/:id/assign`
Assignment update.

Roles: `SUPPORT_AGENT`, `ADMIN`

### PATCH `/tickets/:id/priority`
Priority update.

Roles: `SUPPORT_AGENT`, `ADMIN`

### PATCH `/tickets/:id`
Partial ticket updates (`title`, `description`, `category`).

Roles:
- `SUPPORT_AGENT`, `ADMIN`: any ticket
- `USER`: own ticket while status is `OPEN`

## Ticket AI Endpoints

### POST `/tickets/:id/ai/analyze`
Runs AI analysis and updates ticket fields:
- `category`
- `priority`
- `aiSummary`
- `aiConfidence`
- `aiRecommendedAction`

Response:
```json
{
  "category": "IT",
  "priority": "HIGH",
  "aiSummary": "Ticket summary...",
  "aiConfidence": 0.91,
  "recommendedAction": "Escalate to on-call support...",
  "provider": "mock"
}
```

Visibility:
- `USER`: own ticket only
- `SUPPORT_AGENT`, `ADMIN`: any ticket

### GET `/tickets/:id/ai/suggestion`
Returns AI suggestion payload. If no stored suggestion exists, service can compute one on demand.

Visibility:
- `USER`: own ticket only
- `SUPPORT_AGENT`, `ADMIN`: any ticket

## AI Provider Modes

Environment:
- `AI_PROVIDER=mock` (default)
- `AI_PROVIDER=openai` (optional)

OpenAI-compatible mode uses:
- `OPENAI_API_KEY` (required in openai mode)
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`
- `OPENAI_TIMEOUT_SECONDS`
- `OPENAI_MAX_RETRIES`

## Audit Events

Workflow events:
- `ticket_created`
- `ticket_status_updated`
- `ticket_assigned`
- `ticket_priority_updated`
- `ticket_updated`
- `ticket_resolved`
- `ticket_rejected`

AI events:
- `ticket_ai_analyzed`
- `ticket_ai_analysis_failed`

Audit metadata stores safe before/after and provider context. Secrets are never included.

## Demo Accounts

Seed:
```bash
npm run prisma:seed -w @opspilot/api
```

Users:
- `admin@example.com` (`ADMIN`)
- `agent@example.com` (`SUPPORT_AGENT`)
- `user@example.com` (`USER`)

Password: `Password123!`

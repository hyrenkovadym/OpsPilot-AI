# OpsPilot AI Security Notes (Phase 7)

## Security Goals
- keep platform runnable in local/demo mode without secrets
- enforce auth/RBAC and ownership checks
- avoid secret leakage in logs, responses, and realtime payloads

## Authentication and Authorization
- JWT access token for protected API routes
- role-based access control (`USER`, `SUPPORT_AGENT`, `ADMIN`)
- service-level ownership checks for ticket/job visibility
- websocket connections authenticate via JWT token in Socket.IO auth payload

## Request ID and Error Safety
- API reads `X-Request-ID` or generates one
- response includes `X-Request-ID`
- error body includes `requestId`
- internal stack traces are not exposed in API responses

## Rate Limiting
Route-level limits are applied to:
- `POST /auth/register`
- `POST /auth/login`
- `POST /tickets/:id/ai/analyze`
- `GET /knowledge-base/search`

## Security Headers and CORS
- security headers are added globally (content type, frame, referrer, DNS prefetch, opener policy)
- CORS origins are validated as full URL(s)
- comma-separated origin lists are supported for API and socket CORS settings

## Secrets Handling
Do not commit:
- `.env`, `.env.local`
- API keys
- credentials/service account files

No secrets in:
- `/api/system/info`
- `/api/ready`
- structured logs
- realtime payloads
- public error messages

## AI Safety Constraints
- default `AI_PROVIDER=mock`
- optional OpenAI mode only when configured
- tests never call real OpenAI
- keys are never logged or returned

## Realtime Security
- invalid socket auth is rejected safely
- room subscriptions are permission-checked (`ticket:{id}`, `job:{id}`)
- payloads exclude tokens/passwords/keys/raw prompt dumps
- polling fallback remains available for resiliency

## Audit Safety
Audit events capture operational metadata only.
Avoid storing:
- JWT/token material
- API keys
- full prompt text
- full KB raw content

Audit metadata includes request correlation (`requestId`) where available.

## Remaining Hardening Scope (Phase 8 candidates)
- stricter password policy checks and auth abuse analytics
- optional Redis-backed distributed rate limiting
- secret scanner/pre-commit policy automation
- deployment-specific TLS/proxy hardening checklist

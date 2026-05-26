# OpsPilot AI Security Notes (v1.0.0)

## Security Objectives
- keep the repository free from secrets and private credentials
- enforce least-privilege access with JWT + RBAC + ownership checks
- provide safe operational visibility without leaking sensitive values

## Repository Safety
Ignored by `.gitignore`:
- `.env`
- `.env.local`
- `node_modules/`
- `.next/`
- `dist/`
- `coverage/`
- `logs/`
- common credential/service account file patterns

Policy:
- do not commit API keys, credentials, service account files, or private local artifacts
- use `.env.example` placeholders only

## Authentication and Authorization
- JWT access token protects API routes
- role model: `USER`, `SUPPORT_AGENT`, `ADMIN`
- service-level ownership checks protect tickets/jobs/article visibility
- websocket connections require JWT access token

## Request and Error Safety
- request IDs are accepted via `X-Request-ID` or generated automatically
- response includes `X-Request-ID`
- normalized errors include `requestId`
- internal stack traces are not exposed in public API responses

## Secrets Handling
- no secrets returned from `/api/system/info` or `/api/ready`
- no API keys in structured logs or realtime payloads
- OpenAI API key is optional and only required in `AI_PROVIDER=openai`
- mock mode is default and keyless

## CORS and Headers
- CORS origin values are validated as full URL list
- security headers are enabled for safer default browser behavior

## Rate Limiting
Applied to:
- `POST /auth/register`
- `POST /auth/login`
- `POST /tickets/:id/ai/analyze`
- `GET /knowledge-base/search`

Limitation:
- current limiter is in-memory per process
- production should use distributed rate limiting (Redis-backed) for multi-instance deployments

## Frontend Token Storage Note
- current frontend stores access token in `localStorage` for demo simplicity
- production-grade setup should prefer hardened cookie/session strategy and stricter browser security controls

## Transport and Deployment Requirements
- production deployment must enforce HTTPS/TLS
- secure reverse proxy and trusted host configuration are required for public environments

## Realtime Security
- invalid socket tokens are rejected safely
- room joins are permission-checked (`ticket:{id}`, `job:{id}`)
- payloads exclude tokens, password hashes, API keys, prompts, and full KB raw content
- polling fallback remains available to reduce missed-update risk

## Recommended Next Hardening Steps
- secret scanning in CI/pre-commit hooks
- distributed rate limiting strategy
- token rotation/blacklist strategy for high-security environments
- deployment-specific security baseline checklist (WAF, CSP tuning, HSTS, etc.)

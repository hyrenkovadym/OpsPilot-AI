# OpsPilot AI Architecture

## Monorepo
- `apps/api`: NestJS backend
- `apps/web`: Next.js frontend
- `infra`: Docker Compose runtime
- `docs`: architecture, API, roadmap

## API Modules
- `config`: env loading and validation
- `prisma`: database access layer
- `auth`: register/login/me with JWT
- `users`: user persistence helpers
- `tickets`: lifecycle workflow + AI endpoints
- `ai`: provider abstraction and output validation
- `audit`: centralized event logging
- `health`: health/readiness
- `common`: guards, decorators, shared auth types

## Security and Access
1. JWT auth via `JwtAuthGuard`
2. Role policy via `RolesGuard` and `@Roles(...)`
3. Record-level ticket visibility checks:
   - `USER`: own tickets only
   - `SUPPORT_AGENT`/`ADMIN`: queue-wide visibility
4. Audited lifecycle and AI events

## Data Model
Core entities:
- `User`
- `RefreshToken`
- `Ticket`
- `AuditLog`

Ticket includes AI support fields:
- `aiSummary` (nullable)
- `aiConfidence` (nullable)
- `aiRecommendedAction` (nullable)

## AI Provider Abstraction (Phase 3)

Location: `apps/api/src/ai`

### Contracts
- `AiProvider` interface defines `analyzeTicket(...)`.
- Output must satisfy schema:
  - `category` (`TicketCategory`)
  - `priority` (`TicketPriority`)
  - `aiSummary` (string)
  - `aiConfidence` (0..1)
  - `recommendedAction` (string)

### Providers
- `MockAiProvider`:
  - deterministic keyword-based classification/priority logic
  - default provider for local and test runs
  - no network calls
- `OpenAiCompatibleProvider`:
  - optional mode via `AI_PROVIDER=openai`
  - configurable API base URL/model/timeout/retries
  - strict JSON parsing + schema validation
  - safe error messages (no secret leakage)

### Factory and Service
- `AiProviderFactory` resolves provider from environment
- `AiService` exposes analysis entrypoint to ticket workflow

Default mode: `AI_PROVIDER=mock`

## Ticket + AI Workflow
1. Ticket is created/managed via existing lifecycle endpoints.
2. User/agent/admin triggers `POST /tickets/:id/ai/analyze`.
3. Service runs provider analysis and validates output.
4. Ticket is updated with AI fields and adjusted category/priority.
5. Audit event `ticket_ai_analyzed` is written.
6. On failure, safe error path writes `ticket_ai_analysis_failed`.

Suggestion endpoint:
- `GET /tickets/:id/ai/suggestion`
- returns stored analysis when available, or computes suggestion on demand.

## Frontend Integration
- `apps/web/lib/api.ts` adds:
  - `analyzeTicket(ticketId)`
  - `getTicketAiSuggestion(ticketId)`
- `/tickets/[id]` adds:
  - Run AI analysis action
  - AI summary/confidence/recommended action display
  - low-confidence warning (`aiConfidence < 0.6`)
- `/tickets` list shows AI confidence column

## Reliability and Safety
- App stays runnable without API keys
- Tests use mock mode and mocked fetch for openai-specific tests
- AI output validation prevents invalid persistence
- provider failures are handled without crashing process

## Next Phase
Phase 4 targets knowledge base and simple RAG on top of this provider abstraction.

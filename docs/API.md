# OpsPilot AI API (Phase 4)

Base URL: `http://localhost:4000/api`  
Swagger: `http://localhost:4000/api/docs`

## Auth
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

## Health
- `GET /health`
- `GET /ready`

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

### Ticket Visibility
- `USER`: own tickets only
- `SUPPORT_AGENT`, `ADMIN`: all tickets

### Ticket Filters (`GET /tickets`)
- `status`
- `category`
- `priority`
- `assignedToId`
- `createdById` (ignored for `USER`)
- `search`
- `page` (default `1`)
- `limit` (default `10`)

## Ticket AI Endpoints

- `POST /tickets/:id/ai/analyze`
- `GET /tickets/:id/ai/suggestion`

### Behavior
- Uses configured provider (`mock` by default)
- Retrieves relevant published KB chunks before analysis
- Updates ticket with:
  - `category`
  - `priority`
  - `aiSummary`
  - `aiConfidence`
  - `aiRecommendedAction`
  - `aiContextSourcesJson`

### Response (analyze/suggestion)
```json
{
  "category": "IT",
  "priority": "HIGH",
  "aiSummary": "Short summary...",
  "aiConfidence": 0.86,
  "recommendedAction": "Escalate and follow KB troubleshooting steps.",
  "provider": "mock",
  "contextSources": [
    {
      "articleId": "uuid",
      "title": "IT access issue troubleshooting",
      "score": 12
    }
  ]
}
```

## Knowledge Base

Prefix: `/knowledge-base`

### Endpoints
- `POST /knowledge-base/articles`
- `GET /knowledge-base/articles`
- `GET /knowledge-base/articles/:id`
- `PATCH /knowledge-base/articles/:id`
- `DELETE /knowledge-base/articles/:id`
- `POST /knowledge-base/articles/:id/publish`
- `POST /knowledge-base/articles/:id/archive`
- `POST /knowledge-base/articles/:id/rechunk`
- `GET /knowledge-base/search`

### Article Status
- `DRAFT`
- `PUBLISHED`
- `ARCHIVED`

### Permissions
- `USER`:
  - cannot create/update/publish/archive/delete
  - can read/search published content only
- `SUPPORT_AGENT`:
  - can create/update/publish/archive/rechunk
- `ADMIN`:
  - all permissions (including delete)

### List Articles Query (`GET /knowledge-base/articles`)
- `category`
- `status`
- `search`
- `includeNonPublished` (support/admin only)
- `page`
- `limit`

### Search Query (`GET /knowledge-base/search`)
- `query`
- `category`
- `limit`
- `includeNonPublished` (support/admin only)

### Search Response
- `articleId`
- `articleTitle`
- `category`
- `status`
- `chunkContent`
- `score`

## AI Provider Modes
- `AI_PROVIDER=mock` (default, deterministic, no network)
- `AI_PROVIDER=openai` (optional)

OpenAI-compatible mode uses:
- `OPENAI_API_KEY` (required for openai mode)
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`
- `OPENAI_TIMEOUT_SECONDS`
- `OPENAI_MAX_RETRIES`

## Audit Events

Ticket/auth:
- `user_registered`
- `user_logged_in`
- `ticket_created`
- `ticket_status_updated`
- `ticket_assigned`
- `ticket_priority_updated`
- `ticket_updated`
- `ticket_resolved`
- `ticket_rejected`
- `ticket_ai_analyzed`
- `ticket_ai_analysis_failed`
- `ticket_ai_context_retrieved`

Knowledge base:
- `knowledge_article_created`
- `knowledge_article_updated`
- `knowledge_article_published`
- `knowledge_article_archived`
- `knowledge_article_deleted`
- `knowledge_article_rechunked`
- `knowledge_search_performed`

Audit metadata excludes secrets and API keys.

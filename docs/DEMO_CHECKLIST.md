# OpsPilot AI Demo Checklist

Use this checklist for portfolio demo rehearsal and release validation.

## 1) Start Stack
```bash
docker compose -f infra/docker-compose.yml up -d --build postgres redis api worker web
docker compose -f infra/docker-compose.yml ps
```

## 2) Run Migration and Seed
```bash
docker compose -f infra/docker-compose.yml exec api npm run prisma:migrate
docker compose -f infra/docker-compose.yml exec api npm run prisma:seed
```

## 3) Open URLs
- Frontend: `http://localhost:3000`
- API: `http://localhost:4000/api`
- Swagger: `http://localhost:4000/api/docs`

## 4) Login as User
- `user@example.com` / `Password123!`
- Confirm dashboard and ticket pages load.

## 5) Create Ticket (User)
- Go to `/tickets/new`.
- Submit a new ticket.
- Confirm ticket appears in `/tickets` and detail page opens.

## 6) Login as Support Agent
- `agent@example.com` / `Password123!`
- Open tickets list and locate created user ticket.

## 7) Agent Ticket Workflow
- Assign ticket to self.
- Change status to `IN_PROGRESS`.
- Adjust priority if needed.
- Confirm status and assignment updates are reflected.

## 8) Run AI Analysis
- In ticket detail, click `Run AI analysis`.
- Confirm queued/processing/completed flow.
- Confirm AI summary and confidence appear.
- Confirm context sources are shown when available.

## 9) Knowledge Base Workflow
- Open `/knowledge-base`.
- Create article in `/knowledge-base/new`.
- Open article detail and publish article.
- Run rechunk action.
- Confirm chunks count updates.

## 10) Realtime and Fallback
- Keep two tabs open if possible.
- Confirm ticket/job updates appear with realtime hints/status.
- Confirm polling fallback still reaches final state if event is missed.

## 11) Health and System Endpoints
- `GET /api/health`
- `GET /api/ready`
- `GET /api/system/info`
- Confirm safe, non-secret responses.

## 12) Swagger Check
- Open `http://localhost:4000/api/docs`.
- Confirm auth, tickets, jobs, KB, and health endpoints are documented.

## 13) Optional API/Audit Spot Checks
- Use API calls to verify job status endpoint:
  - `GET /api/jobs/:id`
- Verify audit events exist for key lifecycle actions.

## 14) Run Playwright E2E
```bash
npm run test:e2e -w @opspilot/web
```

If E2E fails with connection errors, verify API/web stack is running first.

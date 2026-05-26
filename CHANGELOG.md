# Changelog

All notable changes to this project will be documented in this file.

## v1.0.0
- NestJS/TypeScript backend
- Next.js frontend
- PostgreSQL/Prisma data layer
- Redis/BullMQ background jobs with worker process
- Socket.IO realtime updates with JWT-authenticated connections
- JWT auth and RBAC permissions model
- End-to-end ticket workflow lifecycle
- Knowledge Base module with simple RAG-style retrieval context
- AI provider abstraction with mock and OpenAI-compatible modes
- Audit logs for auth, ticket, knowledge, AI, and jobs events
- Request IDs and structured logs for observability
- Security hardening with normalized errors, rate limiting, CORS validation, and security headers
- Docker Compose local stack (`postgres`, `redis`, `api`, `worker`, `web`)
- API test coverage (Jest/Supertest) and Playwright E2E setup
- Professional release documentation (API, architecture, jobs, realtime, security, observability)

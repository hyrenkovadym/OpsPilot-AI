# OpsPilot AI Roadmap

## v1.0.0 (Completed)
- Full-stack TypeScript monorepo (`NestJS` + `Next.js`)
- PostgreSQL/Prisma persistence layer
- JWT auth + RBAC + ownership checks
- Ticket lifecycle workflow and audit logs
- AI provider abstraction (default mock, optional OpenAI-compatible)
- Knowledge Base module with deterministic chunking/retrieval (simple RAG-style context)
- BullMQ async jobs + worker process + persisted `BackgroundJob` tracking
- Socket.IO realtime updates with Redis pub/sub bridge
- Request IDs, structured logs, normalized safe error responses
- Rate limiting, security headers, CORS origin validation
- Docker Compose local environment and professional docs

## Post-v1 Priorities
- Production deployment guide and cloud reference architecture
- Distributed rate limiting and stronger session/token hardening patterns
- Metrics/tracing stack (OpenTelemetry + dashboards + alerting)
- Retrieval quality upgrades (embeddings/vector store, reranking)
- Expanded E2E coverage with containerized CI runtime

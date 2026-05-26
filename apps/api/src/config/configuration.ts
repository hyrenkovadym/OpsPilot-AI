export default () => ({
  app: {
    env: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT ?? 4000),
    corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    url: process.env.REDIS_URL,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: '15m',
    refreshExpiresIn: '7d',
  },
  ai: {
    provider: process.env.AI_PROVIDER ?? 'mock',
    openai: {
      apiKey: process.env.OPENAI_API_KEY ?? '',
      baseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      timeoutSeconds: Number(process.env.OPENAI_TIMEOUT_SECONDS ?? 20),
      maxRetries: Number(process.env.OPENAI_MAX_RETRIES ?? 1),
    },
  },
  queue: {
    mode: process.env.QUEUE_MODE ?? 'async',
    bullmq: {
      redisUrl: process.env.BULLMQ_REDIS_URL ?? process.env.REDIS_URL,
      defaultAttempts: Number(process.env.BULLMQ_DEFAULT_ATTEMPTS ?? 3),
      backoffMs: Number(process.env.BULLMQ_BACKOFF_MS ?? 5000),
    },
  },
  realtime: {
    enabled: process.env.REALTIME_ENABLED
      ? process.env.REALTIME_ENABLED.toLowerCase() !== 'false'
      : true,
    corsOrigin:
      process.env.SOCKET_CORS_ORIGIN ??
      process.env.CORS_ORIGIN ??
      'http://localhost:3000',
  },
});

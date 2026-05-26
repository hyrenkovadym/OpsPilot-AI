export interface AppEnv {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  REDIS_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  CORS_ORIGIN: string;
  AI_PROVIDER: 'mock' | 'openai';
  OPENAI_API_KEY: string;
  OPENAI_BASE_URL: string;
  OPENAI_MODEL: string;
  OPENAI_TIMEOUT_SECONDS: number;
  OPENAI_MAX_RETRIES: number;
  QUEUE_MODE: 'sync' | 'async';
  BULLMQ_REDIS_URL: string;
  BULLMQ_DEFAULT_ATTEMPTS: number;
  BULLMQ_BACKOFF_MS: number;
  REALTIME_ENABLED: boolean;
  SOCKET_CORS_ORIGIN: string;
}

const requiredVars: Array<keyof Omit<AppEnv, 'PORT'>> = [
  'NODE_ENV',
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'CORS_ORIGIN',
];

function getRequiredEnv(
  name: keyof Omit<AppEnv, 'PORT'>,
  value: unknown,
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Environment variable ${name} is required`);
  }

  return value;
}

function validateOriginList(value: string, variableName: string): string {
  const origins = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    throw new Error(
      `Environment variable ${variableName} must include at least one origin`,
    );
  }

  for (const origin of origins) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(
        `Environment variable ${variableName} includes invalid URL: ${origin}`,
      );
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(
        `Environment variable ${variableName} includes unsupported protocol: ${origin}`,
      );
    }
  }

  return origins.join(',');
}

export function validateEnv(config: Record<string, unknown>): AppEnv {
  for (const variable of requiredVars) {
    getRequiredEnv(variable, config[variable]);
  }

  const rawPort = config.PORT;
  const port = Number(rawPort ?? 4000);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('Environment variable PORT must be a positive integer');
  }

  const provider =
    typeof config.AI_PROVIDER === 'string' &&
    config.AI_PROVIDER.trim().length > 0
      ? config.AI_PROVIDER.trim().toLowerCase()
      : 'mock';

  if (provider !== 'mock' && provider !== 'openai') {
    throw new Error('Environment variable AI_PROVIDER must be mock or openai');
  }

  const openaiApiKey =
    typeof config.OPENAI_API_KEY === 'string'
      ? config.OPENAI_API_KEY.trim()
      : '';
  const openaiBaseUrl =
    typeof config.OPENAI_BASE_URL === 'string' &&
    config.OPENAI_BASE_URL.trim().length > 0
      ? config.OPENAI_BASE_URL.trim()
      : 'https://api.openai.com/v1';
  const openaiModel =
    typeof config.OPENAI_MODEL === 'string' &&
    config.OPENAI_MODEL.trim().length > 0
      ? config.OPENAI_MODEL.trim()
      : 'gpt-4o-mini';
  const openaiTimeoutSeconds = Number(config.OPENAI_TIMEOUT_SECONDS ?? 20);
  const openaiMaxRetries = Number(config.OPENAI_MAX_RETRIES ?? 1);
  const queueMode =
    typeof config.QUEUE_MODE === 'string' && config.QUEUE_MODE.trim().length > 0
      ? config.QUEUE_MODE.trim().toLowerCase()
      : 'async';
  const bullmqRedisUrl =
    typeof config.BULLMQ_REDIS_URL === 'string' &&
    config.BULLMQ_REDIS_URL.trim().length > 0
      ? config.BULLMQ_REDIS_URL.trim()
      : getRequiredEnv('REDIS_URL', config.REDIS_URL);
  const bullmqDefaultAttempts = Number(config.BULLMQ_DEFAULT_ATTEMPTS ?? 3);
  const bullmqBackoffMs = Number(config.BULLMQ_BACKOFF_MS ?? 5000);
  const realtimeEnabled =
    typeof config.REALTIME_ENABLED === 'string'
      ? config.REALTIME_ENABLED.trim().toLowerCase() !== 'false'
      : true;
  const socketCorsOrigin =
    typeof config.SOCKET_CORS_ORIGIN === 'string' &&
    config.SOCKET_CORS_ORIGIN.trim().length > 0
      ? config.SOCKET_CORS_ORIGIN.trim()
      : getRequiredEnv('CORS_ORIGIN', config.CORS_ORIGIN);

  if (!Number.isFinite(openaiTimeoutSeconds) || openaiTimeoutSeconds <= 0) {
    throw new Error(
      'Environment variable OPENAI_TIMEOUT_SECONDS must be a positive number',
    );
  }

  if (
    !Number.isInteger(openaiMaxRetries) ||
    openaiMaxRetries < 0 ||
    openaiMaxRetries > 5
  ) {
    throw new Error(
      'Environment variable OPENAI_MAX_RETRIES must be an integer between 0 and 5',
    );
  }

  if (provider === 'openai' && openaiApiKey.length === 0) {
    throw new Error(
      'Environment variable OPENAI_API_KEY is required in openai mode',
    );
  }

  if (queueMode !== 'sync' && queueMode !== 'async') {
    throw new Error('Environment variable QUEUE_MODE must be sync or async');
  }

  if (
    !Number.isInteger(bullmqDefaultAttempts) ||
    bullmqDefaultAttempts <= 0 ||
    bullmqDefaultAttempts > 10
  ) {
    throw new Error(
      'Environment variable BULLMQ_DEFAULT_ATTEMPTS must be an integer between 1 and 10',
    );
  }

  if (!Number.isInteger(bullmqBackoffMs) || bullmqBackoffMs < 0) {
    throw new Error(
      'Environment variable BULLMQ_BACKOFF_MS must be an integer greater than or equal to 0',
    );
  }

  return {
    NODE_ENV: getRequiredEnv('NODE_ENV', config.NODE_ENV),
    PORT: port,
    DATABASE_URL: getRequiredEnv('DATABASE_URL', config.DATABASE_URL),
    REDIS_URL: getRequiredEnv('REDIS_URL', config.REDIS_URL),
    JWT_ACCESS_SECRET: getRequiredEnv(
      'JWT_ACCESS_SECRET',
      config.JWT_ACCESS_SECRET,
    ),
    JWT_REFRESH_SECRET: getRequiredEnv(
      'JWT_REFRESH_SECRET',
      config.JWT_REFRESH_SECRET,
    ),
    CORS_ORIGIN: validateOriginList(
      getRequiredEnv('CORS_ORIGIN', config.CORS_ORIGIN),
      'CORS_ORIGIN',
    ),
    AI_PROVIDER: provider,
    OPENAI_API_KEY: openaiApiKey,
    OPENAI_BASE_URL: openaiBaseUrl,
    OPENAI_MODEL: openaiModel,
    OPENAI_TIMEOUT_SECONDS: openaiTimeoutSeconds,
    OPENAI_MAX_RETRIES: openaiMaxRetries,
    QUEUE_MODE: queueMode,
    BULLMQ_REDIS_URL: bullmqRedisUrl,
    BULLMQ_DEFAULT_ATTEMPTS: bullmqDefaultAttempts,
    BULLMQ_BACKOFF_MS: bullmqBackoffMs,
    REALTIME_ENABLED: realtimeEnabled,
    SOCKET_CORS_ORIGIN: validateOriginList(
      socketCorsOrigin,
      'SOCKET_CORS_ORIGIN',
    ),
  };
}

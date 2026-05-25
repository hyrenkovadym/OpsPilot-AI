process.env.NODE_ENV = 'test';
process.env.PORT = '4000';
process.env.DATABASE_URL =
  'postgresql://test:test@localhost:5432/opspilot_test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_ACCESS_SECRET = 'test_access_secret';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.AI_PROVIDER = 'mock';
process.env.OPENAI_API_KEY = '';
process.env.OPENAI_BASE_URL = 'https://api.openai.com/v1';
process.env.OPENAI_MODEL = 'gpt-4o-mini';
process.env.OPENAI_TIMEOUT_SECONDS = '20';
process.env.OPENAI_MAX_RETRIES = '1';

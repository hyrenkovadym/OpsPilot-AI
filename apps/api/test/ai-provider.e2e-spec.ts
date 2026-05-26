import { ConfigService } from '@nestjs/config';
import { TicketCategory, TicketPriority, TicketStatus } from '@prisma/client';
import { AiProviderFactory } from '../src/ai/ai-provider.factory';
import { MockAiProvider } from '../src/ai/mock-ai.provider';
import { OpenAiCompatibleProvider } from '../src/ai/openai-compatible.provider';
import { validateEnv } from '../src/config/env.validation';

function createConfigService(values: Record<string, unknown>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as ConfigService;
}

describe('AI provider configuration and providers', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('default provider resolves to mock when AI_PROVIDER is not set', () => {
    const env = validateEnv({
      NODE_ENV: 'test',
      PORT: '4000',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/opspilot_test',
      REDIS_URL: 'redis://localhost:6379',
      JWT_ACCESS_SECRET: 'x',
      JWT_REFRESH_SECRET: 'y',
      CORS_ORIGIN: 'http://localhost:3000',
    });

    expect(env.AI_PROVIDER).toBe('mock');
  });

  it('AI_PROVIDER=mock uses MockAiProvider', () => {
    const configService = createConfigService({
      'ai.provider': 'mock',
      AI_PROVIDER: 'mock',
      'ai.openai.apiKey': '',
      OPENAI_API_KEY: '',
      'ai.openai.baseUrl': 'https://api.openai.com/v1',
      'ai.openai.model': 'gpt-4o-mini',
      'ai.openai.timeoutSeconds': 20,
      'ai.openai.maxRetries': 1,
    });
    const mockProvider = new MockAiProvider();
    const openaiProvider = new OpenAiCompatibleProvider(configService);
    const factory = new AiProviderFactory(
      configService,
      mockProvider,
      openaiProvider,
    );

    const provider = factory.getProvider();
    expect(provider.name).toBe('mock');
  });

  it('AI_PROVIDER=openai without API key fails clearly', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'test',
        PORT: '4000',
        DATABASE_URL: 'postgresql://test:test@localhost:5432/opspilot_test',
        REDIS_URL: 'redis://localhost:6379',
        JWT_ACCESS_SECRET: 'x',
        JWT_REFRESH_SECRET: 'y',
        CORS_ORIGIN: 'http://localhost:3000',
        AI_PROVIDER: 'openai',
        OPENAI_API_KEY: '',
      }),
    ).toThrow('OPENAI_API_KEY is required in openai mode');
  });

  it('mock provider classifies ticket deterministically and returns valid output', async () => {
    const provider = new MockAiProvider();
    const analysis = await provider.analyzeTicket({
      title: 'urgent login blocked',
      description: 'Production user cannot access VPN and device tools.',
      category: TicketCategory.OTHER,
      priority: TicketPriority.LOW,
      status: TicketStatus.OPEN,
    });

    expect(analysis.category).toBe(TicketCategory.IT);
    expect(analysis.priority).toBe(TicketPriority.HIGH);
    expect(analysis.aiConfidence).toBeGreaterThanOrEqual(0);
    expect(analysis.aiConfidence).toBeLessThanOrEqual(1);
    expect(analysis.aiSummary.length).toBeGreaterThan(0);
    expect(analysis.recommendedAction.length).toBeGreaterThan(0);
  });

  it('openai provider parses valid mocked JSON response', async () => {
    const configService = createConfigService({
      'ai.openai.apiKey': 'test-key',
      OPENAI_API_KEY: 'test-key',
      'ai.openai.baseUrl': 'https://api.openai.com/v1',
      'ai.openai.model': 'gpt-4o-mini',
      'ai.openai.timeoutSeconds': 20,
      'ai.openai.maxRetries': 0,
    });
    const provider = new OpenAiCompatibleProvider(configService);

    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                category: 'IT',
                priority: 'HIGH',
                aiSummary: 'Access issue affecting production workflow.',
                aiConfidence: 0.9,
                recommendedAction:
                  'Escalate to IT on-call and verify credential integrity.',
              }),
            },
          },
        ],
      }),
    } as any);

    const analysis = await provider.analyzeTicket({
      title: 'urgent vpn issue',
      description: 'team is blocked',
      category: TicketCategory.OTHER,
      priority: TicketPriority.LOW,
      status: TicketStatus.OPEN,
    });

    expect(analysis.category).toBe(TicketCategory.IT);
    expect(analysis.priority).toBe(TicketPriority.HIGH);
  });

  it('openai provider handles invalid JSON safely', async () => {
    const configService = createConfigService({
      'ai.openai.apiKey': 'test-key',
      OPENAI_API_KEY: 'test-key',
      'ai.openai.baseUrl': 'https://api.openai.com/v1',
      'ai.openai.model': 'gpt-4o-mini',
      'ai.openai.timeoutSeconds': 20,
      'ai.openai.maxRetries': 0,
    });
    const provider = new OpenAiCompatibleProvider(configService);

    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{invalid json' } }],
      }),
    } as any);

    await expect(
      provider.analyzeTicket({
        title: 'ticket',
        description: 'desc',
        category: TicketCategory.OTHER,
        priority: TicketPriority.LOW,
        status: TicketStatus.OPEN,
      }),
    ).rejects.toThrow('invalid JSON');
  });

  it('openai provider handles schema validation failures safely', async () => {
    const configService = createConfigService({
      'ai.openai.apiKey': 'test-key',
      OPENAI_API_KEY: 'test-key',
      'ai.openai.baseUrl': 'https://api.openai.com/v1',
      'ai.openai.model': 'gpt-4o-mini',
      'ai.openai.timeoutSeconds': 20,
      'ai.openai.maxRetries': 0,
    });
    const provider = new OpenAiCompatibleProvider(configService);

    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                category: 'INVALID',
                priority: 'HIGH',
                aiSummary: 'Summary',
                aiConfidence: 0.9,
                recommendedAction: 'Action',
              }),
            },
          },
        ],
      }),
    } as any);

    await expect(
      provider.analyzeTicket({
        title: 'ticket',
        description: 'desc',
        category: TicketCategory.OTHER,
        priority: TicketPriority.LOW,
        status: TicketStatus.OPEN,
      }),
    ).rejects.toThrow('category must be one of');
  });

  it('openai provider without key fails clearly', () => {
    const configService = createConfigService({
      'ai.openai.apiKey': '',
      OPENAI_API_KEY: '',
      'ai.openai.baseUrl': 'https://api.openai.com/v1',
      'ai.openai.model': 'gpt-4o-mini',
      'ai.openai.timeoutSeconds': 20,
      'ai.openai.maxRetries': 1,
    });
    const provider = new OpenAiCompatibleProvider(configService);

    expect(() => provider.assertConfiguration()).toThrow(
      'OPENAI_API_KEY is required when AI_PROVIDER=openai',
    );
  });
});

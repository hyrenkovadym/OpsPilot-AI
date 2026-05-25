import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AiProvider, AiProviderName } from './ai-provider.interface';
import { MockAiProvider } from './mock-ai.provider';
import { OpenAiCompatibleProvider } from './openai-compatible.provider';

@Injectable()
export class AiProviderFactory {
  constructor(
    private readonly configService: ConfigService,
    private readonly mockProvider: MockAiProvider,
    private readonly openaiProvider: OpenAiCompatibleProvider,
  ) {}

  getProvider(): AiProvider {
    const configuredValue =
      this.configService.get<string>('ai.provider') ??
      this.configService.get<string>('AI_PROVIDER') ??
      'mock';
    const providerName = configuredValue.toLowerCase() as AiProviderName;

    if (providerName === 'openai') {
      this.openaiProvider.assertConfiguration?.();
      return this.openaiProvider;
    }

    return this.mockProvider;
  }
}

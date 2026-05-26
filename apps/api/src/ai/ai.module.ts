import { Module } from '@nestjs/common';
import { AiProviderFactory } from './ai-provider.factory';
import { AiService } from './ai.service';
import { MockAiProvider } from './mock-ai.provider';
import { OpenAiCompatibleProvider } from './openai-compatible.provider';

@Module({
  providers: [
    MockAiProvider,
    OpenAiCompatibleProvider,
    AiProviderFactory,
    AiService,
  ],
  exports: [AiService, AiProviderFactory],
})
export class AiModule {}

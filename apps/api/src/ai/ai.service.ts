import { Injectable } from '@nestjs/common';
import type {
  AiContextChunk,
  AiProviderName,
  AiTicketAnalysis,
  AiTicketInput,
} from './ai-provider.interface';
import { AiProviderFactory } from './ai-provider.factory';

@Injectable()
export class AiService {
  constructor(private readonly aiProviderFactory: AiProviderFactory) {}

  async analyzeTicket(
    ticket: AiTicketInput,
    contextChunks?: AiContextChunk[],
  ): Promise<AiTicketAnalysis> {
    return this.aiProviderFactory
      .getProvider()
      .analyzeTicket(ticket, contextChunks);
  }

  getProviderName(): AiProviderName {
    return this.aiProviderFactory.getProvider().name;
  }
}

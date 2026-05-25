import { Injectable } from '@nestjs/common';
import type {
  AiProviderName,
  AiTicketAnalysis,
  AiTicketInput,
} from './ai-provider.interface';
import { AiProviderFactory } from './ai-provider.factory';

@Injectable()
export class AiService {
  constructor(private readonly aiProviderFactory: AiProviderFactory) {}

  async analyzeTicket(ticket: AiTicketInput): Promise<AiTicketAnalysis> {
    return this.aiProviderFactory.getProvider().analyzeTicket(ticket);
  }

  getProviderName(): AiProviderName {
    return this.aiProviderFactory.getProvider().name;
  }
}

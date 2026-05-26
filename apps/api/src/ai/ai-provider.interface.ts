import { TicketCategory, TicketPriority, TicketStatus } from '@prisma/client';

export type AiProviderName = 'mock' | 'openai';

export interface AiTicketInput {
  id?: string;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
}

export interface AiTicketAnalysis {
  category: TicketCategory;
  priority: TicketPriority;
  aiSummary: string;
  aiConfidence: number;
  recommendedAction: string;
}

export interface AiContextChunk {
  articleId: string;
  articleTitle: string;
  category: TicketCategory;
  chunkContent: string;
  score: number;
}

export interface AiProvider {
  readonly name: AiProviderName;
  analyzeTicket(
    ticket: AiTicketInput,
    contextChunks?: AiContextChunk[],
  ): Promise<AiTicketAnalysis>;
  assertConfiguration?(): void;
}

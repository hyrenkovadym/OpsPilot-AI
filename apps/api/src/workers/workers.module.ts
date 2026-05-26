import { Module } from '@nestjs/common';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';
import { TicketsModule } from '../tickets/tickets.module';
import { KnowledgeBaseProcessor } from './knowledge-base.processor';
import { TicketAiProcessor } from './ticket-ai.processor';

@Module({
  imports: [TicketsModule, KnowledgeBaseModule],
  providers: [TicketAiProcessor, KnowledgeBaseProcessor],
})
export class WorkersModule {}

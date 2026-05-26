import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ChunkingService } from './chunking.service';
import { KnowledgeBaseController } from './knowledge-base.controller';
import { KnowledgeBaseService } from './knowledge-base.service';
import { RetrievalService } from './retrieval.service';

@Module({
  imports: [AuditModule],
  controllers: [KnowledgeBaseController],
  providers: [KnowledgeBaseService, ChunkingService, RetrievalService],
  exports: [KnowledgeBaseService, RetrievalService],
})
export class KnowledgeBaseModule {}

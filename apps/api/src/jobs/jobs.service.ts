import {
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BackgroundJob,
  BackgroundJobStatus,
  BackgroundJobType,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { JOB_NAMES } from './job-names';
import {
  JOB_QUEUE_CLIENT,
  type JobQueueClient,
} from './job-queue-client.interface';
import type {
  AnalyzeTicketJobPayload,
  RechunkArticleJobPayload,
} from './job-payloads';
import { QUEUE_NAMES } from './queues';
import { QueuedJobResponseDto } from './dto/queued-job-response.dto';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    @Inject(JOB_QUEUE_CLIENT) private readonly jobQueueClient: JobQueueClient,
  ) {}

  isAsyncMode(): boolean {
    const mode = this.configService.get<string>('queue.mode') ?? 'async';
    return mode.toLowerCase() === 'async';
  }

  async enqueueTicketAiAnalysis(input: {
    ticketId: string;
    actorId: string;
  }): Promise<QueuedJobResponseDto> {
    const job = await this.prisma.backgroundJob.create({
      data: {
        type: BackgroundJobType.TICKET_AI_ANALYSIS,
        status: BackgroundJobStatus.QUEUED,
        entityType: 'ticket',
        entityId: input.ticketId,
        attempts: 0,
        metadata: {
          queueName: QUEUE_NAMES.ticketAi,
          jobName: JOB_NAMES.analyzeTicket,
          actorId: input.actorId,
        },
      },
    });

    const queueName = QUEUE_NAMES.ticketAi;
    const jobName = JOB_NAMES.analyzeTicket;

    try {
      const payload: AnalyzeTicketJobPayload = {
        backgroundJobId: job.id,
        ticketId: input.ticketId,
        actorId: input.actorId,
      };
      await this.jobQueueClient.enqueueAnalyzeTicket(payload, {
        jobId: job.id,
        attempts: this.defaultAttempts(),
        backoffMs: this.backoffMs(),
      });

      await this.auditService.log({
        actorId: input.actorId,
        action: 'ticket_ai_analysis_queued',
        entityType: 'ticket',
        entityId: input.ticketId,
        metadata: {
          jobId: job.id,
          queueName,
          jobName,
          status: BackgroundJobStatus.QUEUED,
          attempts: 0,
        },
      });
    } catch (error) {
      await this.markFailed({
        jobId: job.id,
        reason: this.safeErrorMessage(error),
        attempts: 1,
      });
      await this.auditService.log({
        actorId: input.actorId,
        action: 'ticket_ai_analysis_failed',
        entityType: 'ticket',
        entityId: input.ticketId,
        metadata: {
          jobId: job.id,
          queueName,
          jobName,
          status: BackgroundJobStatus.FAILED,
          reason: this.safeErrorMessage(error),
        },
      });
      throw new BadGatewayException('Unable to queue ticket AI analysis job.');
    }

    return {
      jobId: job.id,
      entityType: job.entityType,
      entityId: job.entityId,
      status: job.status,
      queueName,
      jobName,
      message: 'Ticket AI analysis queued successfully.',
    };
  }

  async enqueueKnowledgeRechunk(input: {
    articleId: string;
    actorId: string;
  }): Promise<QueuedJobResponseDto> {
    const job = await this.prisma.backgroundJob.create({
      data: {
        type: BackgroundJobType.KNOWLEDGE_BASE_RECHUNK,
        status: BackgroundJobStatus.QUEUED,
        entityType: 'knowledge_article',
        entityId: input.articleId,
        attempts: 0,
        metadata: {
          queueName: QUEUE_NAMES.knowledgeBase,
          jobName: JOB_NAMES.rechunkArticle,
          actorId: input.actorId,
        },
      },
    });

    const queueName = QUEUE_NAMES.knowledgeBase;
    const jobName = JOB_NAMES.rechunkArticle;

    try {
      const payload: RechunkArticleJobPayload = {
        backgroundJobId: job.id,
        articleId: input.articleId,
        actorId: input.actorId,
      };
      await this.jobQueueClient.enqueueRechunkArticle(payload, {
        jobId: job.id,
        attempts: this.defaultAttempts(),
        backoffMs: this.backoffMs(),
      });

      await this.auditService.log({
        actorId: input.actorId,
        action: 'knowledge_article_rechunk_queued',
        entityType: 'knowledge_article',
        entityId: input.articleId,
        metadata: {
          jobId: job.id,
          queueName,
          jobName,
          status: BackgroundJobStatus.QUEUED,
          attempts: 0,
        },
      });
    } catch (error) {
      await this.markFailed({
        jobId: job.id,
        reason: this.safeErrorMessage(error),
        attempts: 1,
      });
      await this.auditService.log({
        actorId: input.actorId,
        action: 'knowledge_article_rechunk_failed',
        entityType: 'knowledge_article',
        entityId: input.articleId,
        metadata: {
          jobId: job.id,
          queueName,
          jobName,
          status: BackgroundJobStatus.FAILED,
          reason: this.safeErrorMessage(error),
        },
      });
      throw new BadGatewayException('Unable to queue knowledge rechunk job.');
    }

    return {
      jobId: job.id,
      entityType: job.entityType,
      entityId: job.entityId,
      status: job.status,
      queueName,
      jobName,
      message: 'Knowledge article rechunk job queued successfully.',
    };
  }

  async getBackgroundJob(jobId: string): Promise<BackgroundJob> {
    const job = await this.prisma.backgroundJob.findUnique({
      where: { id: jobId },
    });
    if (!job) {
      throw new NotFoundException('Background job not found');
    }
    return job;
  }

  async markProcessing(input: {
    jobId: string;
    attempts: number;
  }): Promise<BackgroundJob> {
    const startedAt = new Date();
    const updated = await this.prisma.backgroundJob.update({
      where: { id: input.jobId },
      data: {
        status: BackgroundJobStatus.PROCESSING,
        attempts: input.attempts,
        startedAt,
      },
    });

    this.logger.log(
      `Job started: id=${updated.id} type=${updated.type} entity=${updated.entityType}:${updated.entityId} attempts=${updated.attempts}`,
    );
    return updated;
  }

  async markCompleted(input: {
    jobId: string;
    attempts: number;
    metadata?: Prisma.InputJsonValue;
  }): Promise<BackgroundJob> {
    const finishedAt = new Date();
    const existing = await this.getBackgroundJob(input.jobId);
    const startedAt = existing.startedAt ?? existing.createdAt;
    const durationMs = finishedAt.getTime() - startedAt.getTime();

    const updated = await this.prisma.backgroundJob.update({
      where: { id: input.jobId },
      data: {
        status: BackgroundJobStatus.COMPLETED,
        attempts: input.attempts,
        finishedAt,
        metadata:
          input.metadata ??
          ({
            durationMs,
          } satisfies Prisma.InputJsonValue),
      },
    });

    this.logger.log(
      `Job completed: id=${updated.id} type=${updated.type} entity=${updated.entityType}:${updated.entityId} durationMs=${durationMs}`,
    );
    return updated;
  }

  async markFailed(input: {
    jobId: string;
    reason: string;
    attempts: number;
  }): Promise<BackgroundJob> {
    const finishedAt = new Date();
    const updated = await this.prisma.backgroundJob.update({
      where: { id: input.jobId },
      data: {
        status: BackgroundJobStatus.FAILED,
        attempts: input.attempts,
        finishedAt,
        lastError: input.reason.slice(0, 240),
      },
    });

    this.logger.error(
      `Job failed: id=${updated.id} type=${updated.type} entity=${updated.entityType}:${updated.entityId} attempts=${updated.attempts} reason=${input.reason.slice(0, 120)}`,
    );
    return updated;
  }

  private defaultAttempts(): number {
    return this.configService.get<number>('queue.bullmq.defaultAttempts') ?? 3;
  }

  private backoffMs(): number {
    return this.configService.get<number>('queue.bullmq.backoffMs') ?? 5000;
  }

  private safeErrorMessage(error: unknown): string {
    const message =
      error instanceof Error ? error.message : 'Unknown background job error';
    return message.replace(/sk-[a-zA-Z0-9_-]+/g, '[redacted]').slice(0, 240);
  }
}

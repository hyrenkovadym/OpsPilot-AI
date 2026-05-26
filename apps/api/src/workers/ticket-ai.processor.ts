import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { logStructured } from '../common/logging/structured-log.util';
import { TicketsService } from '../tickets/tickets.service';
import { JOB_NAMES } from '../jobs/job-names';
import type { AnalyzeTicketJobPayload } from '../jobs/job-payloads';
import { JobsService } from '../jobs/jobs.service';
import { QUEUE_NAMES } from '../jobs/queues';

@Injectable()
@Processor(QUEUE_NAMES.ticketAi)
export class TicketAiProcessor extends WorkerHost {
  private readonly logger = new Logger(TicketAiProcessor.name);

  constructor(
    private readonly jobsService: JobsService,
    private readonly ticketsService: TicketsService,
  ) {
    super();
  }

  async process(job: Job<AnalyzeTicketJobPayload>): Promise<void> {
    if (job.name !== JOB_NAMES.analyzeTicket) {
      return;
    }

    const payload = job.data;
    const attempts = job.attemptsMade + 1;
    const startedAt = Date.now();

    await this.jobsService.markProcessing({
      jobId: payload.backgroundJobId,
      attempts,
    });

    this.logger.log(
      `Processing ticket AI job=${payload.backgroundJobId} ticketId=${payload.ticketId}`,
    );
    logStructured('info', 'worker.ticket_ai.started', {
      jobId: payload.backgroundJobId,
      ticketId: payload.ticketId,
      attempts,
    });

    try {
      await this.ticketsService.analyzeTicketForJob({
        ticketId: payload.ticketId,
        actorId: payload.actorId,
        backgroundJobId: payload.backgroundJobId,
        queueName: QUEUE_NAMES.ticketAi,
        jobName: JOB_NAMES.analyzeTicket,
      });

      await this.jobsService.markCompleted({
        jobId: payload.backgroundJobId,
        attempts,
        metadata: {
          durationMs: Date.now() - startedAt,
          queueName: QUEUE_NAMES.ticketAi,
          jobName: JOB_NAMES.analyzeTicket,
        },
      });
      logStructured('info', 'worker.ticket_ai.completed', {
        jobId: payload.backgroundJobId,
        ticketId: payload.ticketId,
        attempts,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      await this.jobsService.markFailed({
        jobId: payload.backgroundJobId,
        attempts,
        reason:
          error instanceof Error ? error.message : 'Ticket AI worker failed',
      });
      logStructured('error', 'worker.ticket_ai.failed', {
        jobId: payload.backgroundJobId,
        ticketId: payload.ticketId,
        attempts,
      });
      throw error;
    }
  }
}

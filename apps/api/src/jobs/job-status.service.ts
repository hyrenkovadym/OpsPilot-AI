import { Injectable, NotFoundException } from '@nestjs/common';
import { KnowledgeArticleStatus, Prisma, Role } from '@prisma/client';
import type { AuthenticatedUser } from '../common/types/jwt-payload.type';
import { PrismaService } from '../prisma/prisma.service';
import { BackgroundJobResponseDto } from './dto/background-job-response.dto';

@Injectable()
export class JobStatusService {
  constructor(private readonly prisma: PrismaService) {}

  async getJobByIdForUser(
    user: AuthenticatedUser,
    jobId: string,
  ): Promise<BackgroundJobResponseDto> {
    const job = await this.prisma.backgroundJob.findUnique({
      where: { id: jobId },
    });
    if (!job) {
      throw new NotFoundException('Job not found');
    }

    await this.assertCanViewJob(user, job);
    return this.toResponse(job);
  }

  async listTicketJobsForUser(
    user: AuthenticatedUser,
    ticketId: string,
  ): Promise<BackgroundJobResponseDto[]> {
    await this.assertCanViewTicket(user, ticketId);
    const jobs = await this.prisma.backgroundJob.findMany({
      where: {
        entityType: 'ticket',
        entityId: ticketId,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return jobs.map((job) => this.toResponse(job));
  }

  private async assertCanViewJob(
    user: AuthenticatedUser,
    job: {
      entityType: string;
      entityId: string;
    },
  ): Promise<void> {
    if (job.entityType === 'ticket') {
      await this.assertCanViewTicket(user, job.entityId);
      return;
    }

    if (job.entityType === 'knowledge_article') {
      await this.assertCanViewArticle(user, job.entityId);
      return;
    }

    if (user.role !== Role.ADMIN) {
      throw new NotFoundException('Job not found');
    }
  }

  private async assertCanViewTicket(
    user: AuthenticatedUser,
    ticketId: string,
  ): Promise<void> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        createdById: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Job not found');
    }

    if (user.role === Role.SUPPORT_AGENT || user.role === Role.ADMIN) {
      return;
    }

    if (ticket.createdById !== user.sub) {
      throw new NotFoundException('Job not found');
    }
  }

  private async assertCanViewArticle(
    user: AuthenticatedUser,
    articleId: string,
  ): Promise<void> {
    const article = await this.prisma.knowledgeBaseArticle.findUnique({
      where: { id: articleId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!article) {
      throw new NotFoundException('Job not found');
    }

    if (user.role === Role.SUPPORT_AGENT || user.role === Role.ADMIN) {
      return;
    }

    if (article.status !== KnowledgeArticleStatus.PUBLISHED) {
      throw new NotFoundException('Job not found');
    }
  }

  private toResponse(job: Prisma.BackgroundJobGetPayload<object>) {
    const durationMs =
      job.startedAt && job.finishedAt
        ? job.finishedAt.getTime() - job.startedAt.getTime()
        : null;

    return {
      id: job.id,
      type: job.type,
      status: job.status,
      entityType: job.entityType,
      entityId: job.entityId,
      attempts: job.attempts,
      lastError: job.lastError,
      metadata: job.metadata,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      durationMs,
    };
  }
}

import {
  BadGatewayException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, TicketStatus } from '@prisma/client';
import { AiAnalysisResponseDto } from '../ai/dto/ai-analysis-response.dto';
import { AiService } from '../ai/ai.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../common/types/jwt-payload.type';
import { QueuedJobResponseDto } from '../jobs/dto/queued-job-response.dto';
import { JobsService } from '../jobs/jobs.service';
import { RetrievalService } from '../knowledge-base/retrieval.service';
import { PrismaService } from '../prisma/prisma.service';
import { REALTIME_EVENTS, REALTIME_ROOMS } from '../realtime/realtime-events';
import { RealtimeService } from '../realtime/realtime.service';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ListTicketsQueryDto } from './dto/list-tickets-query.dto';
import {
  TicketDetailResponseDto,
  type TicketDetailsView,
} from './dto/ticket-detail-response.dto';
import { type TicketsListResponseDto } from './dto/tickets-list-response.dto';
import { UpdateTicketPriorityDto } from './dto/update-ticket-priority.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';

const ticketDetailsInclude = {
  createdBy: {
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
    },
  },
  assignedTo: {
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
    },
  },
} satisfies Prisma.TicketInclude;

type TicketWithUsers = Prisma.TicketGetPayload<{
  include: typeof ticketDetailsInclude;
}>;

type ContextSource = { articleId: string; title: string; score: number };

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly aiService: AiService,
    private readonly jobsService: JobsService,
    private readonly retrievalService: RetrievalService,
    private readonly realtimeService: RealtimeService,
  ) {}

  async create(
    user: AuthenticatedUser,
    dto: CreateTicketDto,
  ): Promise<TicketDetailResponseDto> {
    const ticket = await this.prisma.ticket.create({
      data: {
        title: dto.title,
        description: dto.description,
        category: dto.category,
        priority: dto.priority,
        status: TicketStatus.OPEN,
        createdById: user.sub,
      },
      include: ticketDetailsInclude,
    });

    await this.auditService.log({
      actorId: user.sub,
      action: 'ticket_created',
      entityType: 'ticket',
      entityId: ticket.id,
      metadata: {
        title: ticket.title,
        category: ticket.category,
        priority: ticket.priority,
      },
    });
    await this.emitTicketEvent(REALTIME_EVENTS.ticketCreated, ticket, {
      message: 'Ticket created',
    });

    return TicketDetailResponseDto.fromView(this.mapTicketToView(ticket));
  }

  async findAllForUser(
    user: AuthenticatedUser,
    query: ListTicketsQueryDto,
  ): Promise<TicketsListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where = this.buildWhereClause(user, query);
    const [tickets, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        include: ticketDetailsInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.ticket.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      data: tickets.map((ticket) =>
        TicketDetailResponseDto.fromView(this.mapTicketToView(ticket)),
      ),
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async findByIdForUser(
    user: AuthenticatedUser,
    id: string,
  ): Promise<TicketDetailResponseDto> {
    const ticket = await this.getTicketWithUsers(id);
    this.assertCanViewTicket(user, ticket.createdById);
    return TicketDetailResponseDto.fromView(this.mapTicketToView(ticket));
  }

  async updateStatus(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateTicketStatusDto,
  ): Promise<TicketDetailResponseDto> {
    const existing = await this.getTicketWithUsers(id);
    const previousStatus = existing.status;
    this.assertCanUpdateStatus(user, existing.createdById, dto.status);

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: { status: dto.status },
      include: ticketDetailsInclude,
    });

    const action = this.resolveStatusAuditAction(dto.status);
    await this.auditService.log({
      actorId: user.sub,
      action,
      entityType: 'ticket',
      entityId: id,
      metadata: {
        before: { status: previousStatus },
        after: { status: dto.status },
        note: dto.note ?? null,
      },
    });
    await this.emitTicketEvent(REALTIME_EVENTS.ticketStatusUpdated, updated, {
      message: 'Ticket status updated',
      actorId: user.sub,
      previousStatus,
    });
    await this.emitTicketEvent(REALTIME_EVENTS.ticketUpdated, updated, {
      message: 'Ticket updated',
      actorId: user.sub,
    });

    return TicketDetailResponseDto.fromView(this.mapTicketToView(updated));
  }

  async assignTicket(
    user: AuthenticatedUser,
    id: string,
    dto: AssignTicketDto,
  ): Promise<TicketDetailResponseDto> {
    if (user.role !== Role.SUPPORT_AGENT && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Only support roles can assign tickets');
    }

    const existing = await this.getTicketWithUsers(id);
    const nextAssignedToId = dto.assignedToId ?? user.sub;

    const assignee = await this.prisma.user.findUnique({
      where: { id: nextAssignedToId },
      select: { id: true, role: true },
    });

    if (
      !assignee ||
      (assignee.role !== Role.SUPPORT_AGENT && assignee.role !== Role.ADMIN)
    ) {
      throw new ForbiddenException(
        'Ticket can only be assigned to support agents or admins',
      );
    }

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: { assignedToId: nextAssignedToId },
      include: ticketDetailsInclude,
    });

    await this.auditService.log({
      actorId: user.sub,
      action: 'ticket_assigned',
      entityType: 'ticket',
      entityId: id,
      metadata: {
        before: { assignedToId: existing.assignedToId },
        after: { assignedToId: nextAssignedToId },
      },
    });
    await this.emitTicketEvent(REALTIME_EVENTS.ticketAssigned, updated, {
      message: 'Ticket assigned',
      actorId: user.sub,
      previousAssignedToId: existing.assignedToId,
    });
    await this.emitTicketEvent(REALTIME_EVENTS.ticketUpdated, updated, {
      message: 'Ticket updated',
      actorId: user.sub,
    });

    return TicketDetailResponseDto.fromView(this.mapTicketToView(updated));
  }

  async updatePriority(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateTicketPriorityDto,
  ): Promise<TicketDetailResponseDto> {
    if (user.role !== Role.SUPPORT_AGENT && user.role !== Role.ADMIN) {
      throw new ForbiddenException(
        'Only support roles can update ticket priority',
      );
    }

    const existing = await this.getTicketWithUsers(id);
    const updated = await this.prisma.ticket.update({
      where: { id },
      data: { priority: dto.priority },
      include: ticketDetailsInclude,
    });

    await this.auditService.log({
      actorId: user.sub,
      action: 'ticket_priority_updated',
      entityType: 'ticket',
      entityId: id,
      metadata: {
        before: { priority: existing.priority },
        after: { priority: dto.priority },
      },
    });
    await this.emitTicketEvent(REALTIME_EVENTS.ticketPriorityUpdated, updated, {
      message: 'Ticket priority updated',
      actorId: user.sub,
      previousPriority: existing.priority,
    });
    await this.emitTicketEvent(REALTIME_EVENTS.ticketUpdated, updated, {
      message: 'Ticket updated',
      actorId: user.sub,
    });

    return TicketDetailResponseDto.fromView(this.mapTicketToView(updated));
  }

  async updateTicket(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateTicketDto,
  ): Promise<TicketDetailResponseDto> {
    const existing = await this.getTicketWithUsers(id);
    this.assertCanEditTicket(user, existing);

    const data: Prisma.TicketUpdateInput = {};
    if (dto.title !== undefined) {
      data.title = dto.title;
    }
    if (dto.description !== undefined) {
      data.description = dto.description;
    }
    if (dto.category !== undefined) {
      data.category = dto.category;
    }

    if (Object.keys(data).length === 0) {
      return TicketDetailResponseDto.fromView(this.mapTicketToView(existing));
    }

    const updated = await this.prisma.ticket.update({
      where: { id },
      data,
      include: ticketDetailsInclude,
    });

    await this.auditService.log({
      actorId: user.sub,
      action: 'ticket_updated',
      entityType: 'ticket',
      entityId: id,
      metadata: {
        before: {
          title: existing.title,
          description: existing.description,
          category: existing.category,
        },
        after: {
          title: updated.title,
          description: updated.description,
          category: updated.category,
        },
      },
    });
    await this.emitTicketEvent(REALTIME_EVENTS.ticketUpdated, updated, {
      message: 'Ticket updated',
      actorId: user.sub,
    });

    return TicketDetailResponseDto.fromView(this.mapTicketToView(updated));
  }

  async analyzeTicket(
    user: AuthenticatedUser,
    id: string,
  ): Promise<AiAnalysisResponseDto | QueuedJobResponseDto> {
    const existing = await this.getTicketWithUsers(id);
    this.assertCanViewTicket(user, existing.createdById);

    if (this.jobsService.isAsyncMode()) {
      return this.jobsService.enqueueTicketAiAnalysis({
        actorId: user.sub,
        ticketId: id,
      });
    }

    return this.analyzeTicketSync({
      ticket: existing,
      actorId: user.sub,
    });
  }

  async analyzeTicketForJob(input: {
    ticketId: string;
    actorId: string;
    backgroundJobId: string;
    queueName: string;
    jobName: string;
  }): Promise<AiAnalysisResponseDto> {
    const ticket = await this.getTicketWithUsers(input.ticketId);

    await this.auditService.log({
      actorId: input.actorId,
      action: 'ticket_ai_analysis_started',
      entityType: 'ticket',
      entityId: ticket.id,
      metadata: {
        jobId: input.backgroundJobId,
        queueName: input.queueName,
        jobName: input.jobName,
        status: 'PROCESSING',
      },
    });

    return this.analyzeTicketSync({
      ticket,
      actorId: input.actorId,
      backgroundJobId: input.backgroundJobId,
      queueName: input.queueName,
      jobName: input.jobName,
    });
  }

  private async analyzeTicketSync(input: {
    ticket: TicketWithUsers;
    actorId: string;
    backgroundJobId?: string;
    queueName?: string;
    jobName?: string;
  }): Promise<AiAnalysisResponseDto> {
    const existing = input.ticket;

    const previousCategory = existing.category;
    const previousPriority = existing.priority;
    const provider = this.aiService.getProviderName();

    try {
      const contextChunks = await this.retrievalService.retrieveForTicket({
        title: existing.title,
        description: existing.description,
        category: existing.category,
      });

      const contextSources = this.mapContextSources(contextChunks);

      await this.auditService.log({
        actorId: input.actorId,
        action: 'ticket_ai_context_retrieved',
        entityType: 'ticket',
        entityId: existing.id,
        metadata: {
          jobId: input.backgroundJobId ?? null,
          queueName: input.queueName ?? null,
          jobName: input.jobName ?? null,
          ticketId: existing.id,
          retrievedCount: contextChunks.length,
          sourceArticleIds: Array.from(
            new Set(contextChunks.map((item) => item.articleId)),
          ),
        },
      });

      const analysis = await this.aiService.analyzeTicket(
        {
          id: existing.id,
          title: existing.title,
          description: existing.description,
          category: existing.category,
          priority: existing.priority,
          status: existing.status,
        },
        contextChunks,
      );

      await this.prisma.ticket.update({
        where: { id: existing.id },
        data: {
          category: analysis.category,
          priority: analysis.priority,
          aiSummary: analysis.aiSummary,
          aiConfidence: analysis.aiConfidence,
          aiRecommendedAction: analysis.recommendedAction,
          aiContextSourcesJson: contextSources,
        },
      });
      const updatedTicket = await this.getTicketWithUsers(existing.id);

      await this.auditService.log({
        actorId: input.actorId,
        action: 'ticket_ai_analyzed',
        entityType: 'ticket',
        entityId: existing.id,
        metadata: {
          jobId: input.backgroundJobId ?? null,
          queueName: input.queueName ?? null,
          jobName: input.jobName ?? null,
          provider,
          confidence: analysis.aiConfidence,
          previousCategory,
          previousPriority,
          newCategory: analysis.category,
          newPriority: analysis.priority,
          contextSourcesCount: contextSources.length,
        },
      });
      await this.emitTicketEvent(REALTIME_EVENTS.ticketUpdated, updatedTicket, {
        message: 'Ticket AI analysis applied',
        actorId: input.actorId,
      });
      await this.realtimeService.publish(
        REALTIME_EVENTS.ticketAiCompleted,
        {
          ticketId: updatedTicket.id,
          status: updatedTicket.status,
          category: updatedTicket.category,
          priority: updatedTicket.priority,
          aiConfidence: analysis.aiConfidence,
          message: 'Ticket AI analysis completed',
        },
        {
          rooms: this.buildTicketRooms(updatedTicket, input.actorId),
        },
      );

      return AiAnalysisResponseDto.fromAnalysis(
        analysis,
        provider,
        contextSources,
      );
    } catch (error) {
      await this.auditService.log({
        actorId: input.actorId,
        action: 'ticket_ai_analysis_failed',
        entityType: 'ticket',
        entityId: existing.id,
        metadata: {
          jobId: input.backgroundJobId ?? null,
          queueName: input.queueName ?? null,
          jobName: input.jobName ?? null,
          provider,
          previousCategory,
          previousPriority,
          reason: this.safeErrorMessage(error),
        },
      });
      await this.realtimeService.publish(
        REALTIME_EVENTS.ticketAiFailed,
        {
          ticketId: existing.id,
          status: existing.status,
          reason: this.safeErrorMessage(error),
          message: 'Ticket AI analysis failed',
        },
        {
          rooms: this.buildTicketRooms(existing, input.actorId),
        },
      );
      throw new BadGatewayException(
        'AI analysis failed. Please try again later.',
      );
    }
  }

  async getAiSuggestion(
    user: AuthenticatedUser,
    id: string,
  ): Promise<AiAnalysisResponseDto> {
    const ticket = await this.getTicketWithUsers(id);
    this.assertCanViewTicket(user, ticket.createdById);

    const provider = this.aiService.getProviderName();
    const storedSources = this.parseContextSources(ticket.aiContextSourcesJson);

    if (
      ticket.aiSummary &&
      ticket.aiConfidence !== null &&
      ticket.aiRecommendedAction
    ) {
      return AiAnalysisResponseDto.fromAnalysis(
        {
          category: ticket.category,
          priority: ticket.priority,
          aiSummary: ticket.aiSummary,
          aiConfidence: ticket.aiConfidence,
          recommendedAction: ticket.aiRecommendedAction,
        },
        provider,
        storedSources,
      );
    }

    try {
      const contextChunks = await this.retrievalService.retrieveForTicket({
        title: ticket.title,
        description: ticket.description,
        category: ticket.category,
      });
      const contextSources = this.mapContextSources(contextChunks);

      const analysis = await this.aiService.analyzeTicket(
        {
          id: ticket.id,
          title: ticket.title,
          description: ticket.description,
          category: ticket.category,
          priority: ticket.priority,
          status: ticket.status,
        },
        contextChunks,
      );

      return AiAnalysisResponseDto.fromAnalysis(
        analysis,
        provider,
        contextSources,
      );
    } catch (error) {
      await this.auditService.log({
        actorId: user.sub,
        action: 'ticket_ai_analysis_failed',
        entityType: 'ticket',
        entityId: id,
        metadata: {
          provider,
          previousCategory: ticket.category,
          previousPriority: ticket.priority,
          reason: this.safeErrorMessage(error),
        },
      });
      throw new BadGatewayException(
        'AI suggestion is unavailable right now. Please try again later.',
      );
    }
  }

  private buildWhereClause(
    user: AuthenticatedUser,
    query: ListTicketsQueryDto,
  ): Prisma.TicketWhereInput {
    const where: Prisma.TicketWhereInput = {};

    if (user.role === Role.USER) {
      where.createdById = user.sub;
    } else if (query.createdById) {
      where.createdById = query.createdById;
    }

    if (query.status) {
      where.status = query.status;
    }
    if (query.category) {
      where.category = query.category;
    }
    if (query.priority) {
      where.priority = query.priority;
    }
    if (query.assignedToId) {
      where.assignedToId = query.assignedToId;
    }
    if (query.search) {
      where.OR = [
        {
          title: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
      ];
    }

    return where;
  }

  private async getTicketWithUsers(id: string): Promise<TicketWithUsers> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: ticketDetailsInclude,
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    return ticket;
  }

  private mapTicketToView(ticket: TicketWithUsers): TicketDetailsView {
    return {
      id: ticket.id,
      title: ticket.title,
      description: ticket.description,
      category: ticket.category,
      status: ticket.status,
      priority: ticket.priority,
      createdById: ticket.createdById,
      assignedToId: ticket.assignedToId,
      aiSummary: ticket.aiSummary,
      aiConfidence: ticket.aiConfidence,
      aiRecommendedAction: ticket.aiRecommendedAction,
      aiContextSourcesJson: ticket.aiContextSourcesJson,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      createdBy: {
        id: ticket.createdBy.id,
        email: ticket.createdBy.email,
        fullName: ticket.createdBy.fullName,
        role: ticket.createdBy.role,
      },
      assignedTo: ticket.assignedTo
        ? {
            id: ticket.assignedTo.id,
            email: ticket.assignedTo.email,
            fullName: ticket.assignedTo.fullName,
            role: ticket.assignedTo.role,
          }
        : null,
    };
  }

  private async emitTicketEvent(
    event: (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS],
    ticket: Pick<
      TicketWithUsers,
      'id' | 'status' | 'priority' | 'category' | 'assignedToId' | 'createdById'
    >,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    await this.realtimeService.publish(
      event,
      {
        ticketId: ticket.id,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category,
        assignedToId: ticket.assignedToId,
        createdById: ticket.createdById,
        ...metadata,
      },
      {
        rooms: this.buildTicketRooms(
          ticket,
          typeof metadata.actorId === 'string' ? metadata.actorId : undefined,
        ),
      },
    );
  }

  private buildTicketRooms(
    ticket: Pick<TicketWithUsers, 'id' | 'createdById' | 'assignedToId'>,
    actorId?: string,
  ): string[] {
    const rooms = [
      REALTIME_ROOMS.supportAll,
      REALTIME_ROOMS.ticket(ticket.id),
      REALTIME_ROOMS.user(ticket.createdById),
    ];

    if (ticket.assignedToId) {
      rooms.push(REALTIME_ROOMS.user(ticket.assignedToId));
    }

    if (actorId) {
      rooms.push(REALTIME_ROOMS.user(actorId));
    }

    return Array.from(new Set(rooms));
  }

  private assertCanViewTicket(
    user: AuthenticatedUser,
    createdById: string,
  ): void {
    if (user.role === Role.SUPPORT_AGENT || user.role === Role.ADMIN) {
      return;
    }

    if (createdById !== user.sub) {
      throw new NotFoundException('Ticket not found');
    }
  }

  private assertCanUpdateStatus(
    user: AuthenticatedUser,
    createdById: string,
    nextStatus: TicketStatus,
  ): void {
    if (user.role === Role.SUPPORT_AGENT || user.role === Role.ADMIN) {
      return;
    }

    if (createdById !== user.sub) {
      throw new NotFoundException('Ticket not found');
    }

    if (nextStatus !== TicketStatus.RESOLVED) {
      throw new ForbiddenException(
        'Users can only mark their own tickets as resolved',
      );
    }
  }

  private assertCanEditTicket(
    user: AuthenticatedUser,
    ticket: TicketWithUsers,
  ): void {
    if (user.role === Role.SUPPORT_AGENT || user.role === Role.ADMIN) {
      return;
    }

    if (ticket.createdById !== user.sub) {
      throw new NotFoundException('Ticket not found');
    }

    if (ticket.status !== TicketStatus.OPEN) {
      throw new ForbiddenException(
        'Users can only edit their tickets while status is OPEN',
      );
    }
  }

  private resolveStatusAuditAction(status: TicketStatus): string {
    if (status === TicketStatus.RESOLVED) {
      return 'ticket_resolved';
    }

    if (status === TicketStatus.REJECTED) {
      return 'ticket_rejected';
    }

    return 'ticket_status_updated';
  }

  private safeErrorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : 'Unknown AI error';
    return message.replace(/sk-[a-zA-Z0-9_-]+/g, '[redacted]').slice(0, 240);
  }

  private mapContextSources(
    chunks: Array<{ articleId: string; articleTitle: string; score: number }>,
  ): ContextSource[] {
    return chunks.map((item) => ({
      articleId: item.articleId,
      title: item.articleTitle,
      score: item.score,
    }));
  }

  private parseContextSources(value: unknown): ContextSource[] | null {
    if (!Array.isArray(value)) {
      return null;
    }

    const parsed = value
      .map((item) => {
        if (typeof item !== 'object' || item === null) {
          return null;
        }
        const row = item as Record<string, unknown>;
        if (
          typeof row.articleId === 'string' &&
          typeof row.title === 'string' &&
          typeof row.score === 'number'
        ) {
          return {
            articleId: row.articleId,
            title: row.title,
            score: row.score,
          };
        }
        return null;
      })
      .filter((item): item is ContextSource => item !== null);

    return parsed.length > 0 ? parsed : null;
  }
}

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
import { PrismaService } from '../prisma/prisma.service';
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

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly aiService: AiService,
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

    return TicketDetailResponseDto.fromView(this.mapTicketToView(updated));
  }

  async analyzeTicket(
    user: AuthenticatedUser,
    id: string,
  ): Promise<AiAnalysisResponseDto> {
    const existing = await this.getTicketWithUsers(id);
    this.assertCanViewTicket(user, existing.createdById);

    const previousCategory = existing.category;
    const previousPriority = existing.priority;
    const provider = this.aiService.getProviderName();

    try {
      const analysis = await this.aiService.analyzeTicket({
        id: existing.id,
        title: existing.title,
        description: existing.description,
        category: existing.category,
        priority: existing.priority,
        status: existing.status,
      });

      await this.prisma.ticket.update({
        where: { id },
        data: {
          category: analysis.category,
          priority: analysis.priority,
          aiSummary: analysis.aiSummary,
          aiConfidence: analysis.aiConfidence,
          aiRecommendedAction: analysis.recommendedAction,
        },
      });

      await this.auditService.log({
        actorId: user.sub,
        action: 'ticket_ai_analyzed',
        entityType: 'ticket',
        entityId: id,
        metadata: {
          provider,
          confidence: analysis.aiConfidence,
          previousCategory,
          previousPriority,
          newCategory: analysis.category,
          newPriority: analysis.priority,
        },
      });

      return AiAnalysisResponseDto.fromAnalysis(analysis, provider);
    } catch (error) {
      await this.auditService.log({
        actorId: user.sub,
        action: 'ticket_ai_analysis_failed',
        entityType: 'ticket',
        entityId: id,
        metadata: {
          provider,
          previousCategory,
          previousPriority,
          reason: this.safeErrorMessage(error),
        },
      });
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
      );
    }

    try {
      const analysis = await this.aiService.analyzeTicket({
        id: ticket.id,
        title: ticket.title,
        description: ticket.description,
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status,
      });

      return AiAnalysisResponseDto.fromAnalysis(analysis, provider);
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
}

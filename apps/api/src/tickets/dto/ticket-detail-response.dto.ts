import { ApiProperty } from '@nestjs/swagger';
import { TicketCategory, TicketPriority, TicketStatus } from '@prisma/client';
import { TicketUserSummaryDto } from './ticket-user-summary.dto';

export interface TicketDetailsView {
  id: string;
  title: string;
  description: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: TicketPriority;
  createdById: string;
  assignedToId: string | null;
  aiSummary: string | null;
  aiConfidence: number | null;
  aiRecommendedAction: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: TicketUserSummaryDto;
  assignedTo: TicketUserSummaryDto | null;
}

export class TicketDetailResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ enum: TicketCategory })
  category!: TicketCategory;

  @ApiProperty({ enum: TicketStatus })
  status!: TicketStatus;

  @ApiProperty({ enum: TicketPriority })
  priority!: TicketPriority;

  @ApiProperty()
  createdById!: string;

  @ApiProperty({ required: false, nullable: true })
  assignedToId!: string | null;

  @ApiProperty({ required: false, nullable: true })
  aiSummary!: string | null;

  @ApiProperty({ required: false, nullable: true })
  aiConfidence!: number | null;

  @ApiProperty({ required: false, nullable: true })
  aiRecommendedAction!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ type: TicketUserSummaryDto })
  createdBy!: TicketUserSummaryDto;

  @ApiProperty({ type: TicketUserSummaryDto, nullable: true })
  assignedTo!: TicketUserSummaryDto | null;

  static fromView(ticket: TicketDetailsView): TicketDetailResponseDto {
    const dto = new TicketDetailResponseDto();
    dto.id = ticket.id;
    dto.title = ticket.title;
    dto.description = ticket.description;
    dto.category = ticket.category;
    dto.status = ticket.status;
    dto.priority = ticket.priority;
    dto.createdById = ticket.createdById;
    dto.assignedToId = ticket.assignedToId;
    dto.aiSummary = ticket.aiSummary;
    dto.aiConfidence = ticket.aiConfidence;
    dto.aiRecommendedAction = ticket.aiRecommendedAction;
    dto.createdAt = ticket.createdAt;
    dto.updatedAt = ticket.updatedAt;
    dto.createdBy = ticket.createdBy;
    dto.assignedTo = ticket.assignedTo;
    return dto;
  }
}

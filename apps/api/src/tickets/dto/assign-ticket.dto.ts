import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class AssignTicketDto {
  @ApiPropertyOptional({
    nullable: true,
    description: 'Assignee user id (UUID). Send null to unassign.',
  })
  @IsOptional()
  @IsUUID()
  assignedToId?: string;
}

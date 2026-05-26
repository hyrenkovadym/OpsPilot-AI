import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class TicketUserSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  fullName!: string;

  @ApiProperty({ enum: Role })
  role!: Role;
}

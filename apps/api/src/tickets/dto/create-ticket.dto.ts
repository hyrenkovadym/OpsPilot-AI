import { ApiProperty } from '@nestjs/swagger';
import { TicketCategory, TicketPriority } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateTicketDto {
  @ApiProperty({ example: 'Need VPN access for remote onboarding' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title!: string;

  @ApiProperty({
    example:
      'Please provide VPN credentials and setup instructions for the new employee by Monday.',
  })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({ enum: TicketCategory, example: TicketCategory.IT })
  @IsEnum(TicketCategory)
  category!: TicketCategory;

  @ApiProperty({ enum: TicketPriority, example: TicketPriority.MEDIUM })
  @IsEnum(TicketPriority)
  priority!: TicketPriority;
}

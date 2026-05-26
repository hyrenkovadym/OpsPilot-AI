import { ApiProperty } from '@nestjs/swagger';
import { TicketCategory } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateArticleDto {
  @ApiProperty({ example: 'IT access issue troubleshooting guide' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  title!: string;

  @ApiProperty({
    example:
      'If a user cannot access the internal dashboard, verify account status and reset SSO session.',
  })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiProperty({ enum: TicketCategory, example: TicketCategory.IT })
  @IsEnum(TicketCategory)
  category!: TicketCategory;
}

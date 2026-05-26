import { ApiProperty } from '@nestjs/swagger';
import { KnowledgeArticleStatus, TicketCategory } from '@prisma/client';

export class ArticleResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  content!: string;

  @ApiProperty({ enum: TicketCategory })
  category!: TicketCategory;

  @ApiProperty({ enum: KnowledgeArticleStatus })
  status!: KnowledgeArticleStatus;

  @ApiProperty()
  createdById!: string;

  @ApiProperty({ nullable: true, required: false })
  updatedById!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty()
  chunksCount!: number;
}

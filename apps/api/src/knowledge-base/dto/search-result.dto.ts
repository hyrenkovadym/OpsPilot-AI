import { ApiProperty } from '@nestjs/swagger';
import { KnowledgeArticleStatus, TicketCategory } from '@prisma/client';

export class SearchResultDto {
  @ApiProperty()
  articleId!: string;

  @ApiProperty()
  articleTitle!: string;

  @ApiProperty({ enum: TicketCategory })
  category!: TicketCategory;

  @ApiProperty({ enum: KnowledgeArticleStatus })
  status!: KnowledgeArticleStatus;

  @ApiProperty()
  chunkContent!: string;

  @ApiProperty()
  score!: number;
}

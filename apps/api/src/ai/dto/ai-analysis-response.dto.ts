import { ApiProperty } from '@nestjs/swagger';
import { TicketCategory, TicketPriority } from '@prisma/client';
import type {
  AiProviderName,
  AiTicketAnalysis,
} from '../ai-provider.interface';

export class AiContextSourceDto {
  @ApiProperty()
  articleId!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  score!: number;
}

export class AiAnalysisResponseDto implements AiTicketAnalysis {
  @ApiProperty({ enum: TicketCategory })
  category!: TicketCategory;

  @ApiProperty({ enum: TicketPriority })
  priority!: TicketPriority;

  @ApiProperty()
  aiSummary!: string;

  @ApiProperty({ minimum: 0, maximum: 1 })
  aiConfidence!: number;

  @ApiProperty()
  recommendedAction!: string;

  @ApiProperty({ enum: ['mock', 'openai'] })
  provider!: AiProviderName;

  @ApiProperty({
    type: AiContextSourceDto,
    isArray: true,
    required: false,
    nullable: true,
  })
  contextSources?: AiContextSourceDto[] | null;

  static fromAnalysis(
    analysis: AiTicketAnalysis,
    provider: AiProviderName,
    contextSources?: AiContextSourceDto[] | null,
  ): AiAnalysisResponseDto {
    const dto = new AiAnalysisResponseDto();
    dto.category = analysis.category;
    dto.priority = analysis.priority;
    dto.aiSummary = analysis.aiSummary;
    dto.aiConfidence = analysis.aiConfidence;
    dto.recommendedAction = analysis.recommendedAction;
    dto.provider = provider;
    dto.contextSources = contextSources ?? null;
    return dto;
  }
}

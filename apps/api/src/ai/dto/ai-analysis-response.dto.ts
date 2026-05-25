import { ApiProperty } from '@nestjs/swagger';
import { TicketCategory, TicketPriority } from '@prisma/client';
import type {
  AiProviderName,
  AiTicketAnalysis,
} from '../ai-provider.interface';

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

  static fromAnalysis(
    analysis: AiTicketAnalysis,
    provider: AiProviderName,
  ): AiAnalysisResponseDto {
    const dto = new AiAnalysisResponseDto();
    dto.category = analysis.category;
    dto.priority = analysis.priority;
    dto.aiSummary = analysis.aiSummary;
    dto.aiConfidence = analysis.aiConfidence;
    dto.recommendedAction = analysis.recommendedAction;
    dto.provider = provider;
    return dto;
  }
}

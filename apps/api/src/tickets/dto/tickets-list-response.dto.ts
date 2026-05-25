import { ApiProperty } from '@nestjs/swagger';
import { TicketDetailResponseDto } from './ticket-detail-response.dto';

export class TicketsListMetaDto {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class TicketsListResponseDto {
  @ApiProperty({ type: TicketDetailResponseDto, isArray: true })
  data!: TicketDetailResponseDto[];

  @ApiProperty({ type: TicketsListMetaDto })
  meta!: TicketsListMetaDto;
}

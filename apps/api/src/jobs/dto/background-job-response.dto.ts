import { ApiProperty } from '@nestjs/swagger';
import { BackgroundJobStatus, BackgroundJobType } from '@prisma/client';

export class BackgroundJobResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: BackgroundJobType })
  type!: BackgroundJobType;

  @ApiProperty({ enum: BackgroundJobStatus })
  status!: BackgroundJobStatus;

  @ApiProperty()
  entityType!: string;

  @ApiProperty()
  entityId!: string;

  @ApiProperty()
  attempts!: number;

  @ApiProperty({ required: false, nullable: true })
  lastError!: string | null;

  @ApiProperty({ required: false, nullable: true })
  metadata!: unknown;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ required: false, nullable: true })
  startedAt!: Date | null;

  @ApiProperty({ required: false, nullable: true })
  finishedAt!: Date | null;
}

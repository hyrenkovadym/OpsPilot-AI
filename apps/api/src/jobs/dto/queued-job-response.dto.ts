import { ApiProperty } from '@nestjs/swagger';
import { BackgroundJobStatus } from '@prisma/client';

export class QueuedJobResponseDto {
  @ApiProperty()
  jobId!: string;

  @ApiProperty()
  entityType!: string;

  @ApiProperty()
  entityId!: string;

  @ApiProperty({ enum: BackgroundJobStatus })
  status!: BackgroundJobStatus;

  @ApiProperty()
  queueName!: string;

  @ApiProperty()
  jobName!: string;

  @ApiProperty()
  message!: string;
}

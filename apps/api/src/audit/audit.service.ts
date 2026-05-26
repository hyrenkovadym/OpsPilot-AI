import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { REALTIME_EVENTS, REALTIME_ROOMS } from '../realtime/realtime-events';
import { RealtimeService } from '../realtime/realtime.service';

export interface CreateAuditLogInput {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
  ) {}

  async log(input: CreateAuditLogInput): Promise<void> {
    const log = await this.prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata ?? {},
      },
    });

    await this.realtimeService.publish(
      REALTIME_EVENTS.auditCreated,
      {
        auditId: log.id,
        actorId: log.actorId,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
      },
      {
        rooms: [REALTIME_ROOMS.supportAll],
      },
    );
  }
}

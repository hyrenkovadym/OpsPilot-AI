import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { getRequestId } from '../common/context/request-context';
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
    const requestId = getRequestId() ?? null;
    const log = await this.prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: this.withRequestId(input.metadata, requestId),
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
        requestId,
      },
      {
        rooms: [REALTIME_ROOMS.supportAll],
      },
    );
  }

  private withRequestId(
    metadata: Prisma.InputJsonValue | undefined,
    requestId: string | null,
  ): Prisma.InputJsonValue {
    const base = metadata ?? {};
    if (typeof base !== 'object' || base === null || Array.isArray(base)) {
      return {
        value: base as Prisma.InputJsonValue,
        requestId,
      };
    }

    return {
      ...(base as Prisma.InputJsonObject),
      requestId,
    };
  }
}

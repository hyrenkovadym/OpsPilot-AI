import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Injectable, Logger } from '@nestjs/common';
import { KnowledgeArticleStatus, Role } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import type { AuthenticatedUser } from '../common/types/jwt-payload.type';
import { PrismaService } from '../prisma/prisma.service';
import { REALTIME_ROOMS, type RealtimeEventEnvelope } from './realtime-events';
import { RealtimeService } from './realtime.service';
import { SocketAuthGuard } from './socket-auth.guard';

interface RoomRequestBody {
  ticketId?: string;
  jobId?: string;
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: process.env.SOCKET_CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly realtimeService: RealtimeService,
    private readonly socketAuthGuard: SocketAuthGuard,
    private readonly prisma: PrismaService,
  ) {}

  afterInit(): void {
    this.realtimeService.registerGatewayEmitter(this);
    this.logger.log('Realtime gateway initialized');
  }

  async handleConnection(client: Socket): Promise<void> {
    if (!this.realtimeService.isEnabled()) {
      client.disconnect(true);
      return;
    }

    try {
      const user = await this.socketAuthGuard.authenticateClient(client);
      this.setSocketUser(client, user);

      await client.join(REALTIME_ROOMS.user(user.sub));
      if (user.role === Role.SUPPORT_AGENT || user.role === Role.ADMIN) {
        await client.join(REALTIME_ROOMS.supportAll);
      }
      if (user.role === Role.ADMIN) {
        await client.join(REALTIME_ROOMS.adminAll);
      }
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const user = this.getUserFromSocket(client);
    if (user) {
      this.logger.debug(`Socket disconnected for user=${user.sub}`);
    }
  }

  @SubscribeMessage('subscribe.ticket')
  async subscribeTicket(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: RoomRequestBody,
  ): Promise<{ ok: boolean; room: string }> {
    const user = this.requireSocketUser(client);
    const ticketId = this.requireId(body.ticketId, 'ticketId');
    await this.assertCanViewTicket(user, ticketId);

    const room = REALTIME_ROOMS.ticket(ticketId);
    await client.join(room);
    return { ok: true, room };
  }

  @SubscribeMessage('unsubscribe.ticket')
  async unsubscribeTicket(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: RoomRequestBody,
  ): Promise<{ ok: boolean; room: string }> {
    const ticketId = this.requireId(body.ticketId, 'ticketId');
    const room = REALTIME_ROOMS.ticket(ticketId);
    await client.leave(room);
    return { ok: true, room };
  }

  @SubscribeMessage('subscribe.job')
  async subscribeJob(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: RoomRequestBody,
  ): Promise<{ ok: boolean; room: string }> {
    const user = this.requireSocketUser(client);
    const jobId = this.requireId(body.jobId, 'jobId');
    await this.assertCanViewJob(user, jobId);

    const room = REALTIME_ROOMS.job(jobId);
    await client.join(room);
    return { ok: true, room };
  }

  @SubscribeMessage('unsubscribe.job')
  async unsubscribeJob(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: RoomRequestBody,
  ): Promise<{ ok: boolean; room: string }> {
    const jobId = this.requireId(body.jobId, 'jobId');
    const room = REALTIME_ROOMS.job(jobId);
    await client.leave(room);
    return { ok: true, room };
  }

  emitEnvelope(envelope: RealtimeEventEnvelope): void {
    if (!this.server) {
      return;
    }

    const payload = {
      ...envelope.payload,
      timestamp: envelope.timestamp,
    };

    const rooms = Array.from(new Set(envelope.options.rooms ?? []));
    if (envelope.options.broadcast || rooms.length === 0) {
      this.server.emit(envelope.event, payload);
      return;
    }

    this.server.to(rooms).emit(envelope.event, payload);
  }

  private getUserFromSocket(client: Socket): AuthenticatedUser | null {
    const rawUser = (client.data as Record<string, unknown>)['user'];
    if (typeof rawUser !== 'object' || rawUser === null) {
      return null;
    }

    const user = rawUser as Record<string, unknown>;
    if (
      typeof user.sub !== 'string' ||
      typeof user.email !== 'string' ||
      (user.role !== Role.USER &&
        user.role !== Role.SUPPORT_AGENT &&
        user.role !== Role.ADMIN)
    ) {
      return null;
    }

    return {
      sub: user.sub,
      email: user.email,
      role: user.role,
    };
  }

  private setSocketUser(client: Socket, user: AuthenticatedUser): void {
    (client.data as { user?: AuthenticatedUser }).user = user;
  }

  private requireSocketUser(client: Socket): AuthenticatedUser {
    const user = this.getUserFromSocket(client);
    if (!user) {
      throw new WsException('Unauthorized socket user');
    }

    return user;
  }

  private requireId(value: string | undefined, fieldName: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new WsException(`${fieldName} is required`);
    }

    return value;
  }

  private async assertCanViewTicket(
    user: AuthenticatedUser,
    ticketId: string,
  ): Promise<void> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        createdById: true,
      },
    });

    if (!ticket) {
      throw new WsException('Ticket not found');
    }

    if (user.role === Role.SUPPORT_AGENT || user.role === Role.ADMIN) {
      return;
    }

    if (ticket.createdById !== user.sub) {
      throw new WsException('Forbidden room subscription');
    }
  }

  private async assertCanViewJob(
    user: AuthenticatedUser,
    jobId: string,
  ): Promise<void> {
    const job = await this.prisma.backgroundJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        entityType: true,
        entityId: true,
      },
    });

    if (!job) {
      throw new WsException('Job not found');
    }

    if (job.entityType === 'ticket') {
      await this.assertCanViewTicket(user, job.entityId);
      return;
    }

    if (job.entityType === 'knowledge_article') {
      const article = await this.prisma.knowledgeBaseArticle.findUnique({
        where: { id: job.entityId },
        select: {
          id: true,
          status: true,
        },
      });

      if (!article) {
        throw new WsException('Job not found');
      }

      if (user.role === Role.SUPPORT_AGENT || user.role === Role.ADMIN) {
        return;
      }

      if (article.status !== KnowledgeArticleStatus.PUBLISHED) {
        throw new WsException('Forbidden room subscription');
      }
      return;
    }

    if (user.role !== Role.ADMIN) {
      throw new WsException('Forbidden room subscription');
    }
  }
}

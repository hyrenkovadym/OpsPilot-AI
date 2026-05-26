'use client';

import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from './api';

export type RealtimeEventName =
  | 'ticket.created'
  | 'ticket.updated'
  | 'ticket.status.updated'
  | 'ticket.assigned'
  | 'ticket.priority.updated'
  | 'job.queued'
  | 'job.processing'
  | 'job.completed'
  | 'job.failed'
  | 'ticket.ai.queued'
  | 'ticket.ai.processing'
  | 'ticket.ai.completed'
  | 'ticket.ai.failed'
  | 'knowledge.rechunk.queued'
  | 'knowledge.rechunk.processing'
  | 'knowledge.rechunk.completed'
  | 'knowledge.rechunk.failed'
  | 'audit.created';

let socketRef: Socket | null = null;
let socketToken: string | null = null;

function resolveSocketBaseUrl(): string {
  try {
    const parsed = new URL(API_BASE_URL);
    parsed.pathname = '';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return 'http://localhost:4000';
  }
}

export function connectRealtime(token: string): Socket | null {
  if (typeof window === 'undefined' || !token) {
    return null;
  }

  if (socketRef && socketToken === token) {
    return socketRef;
  }

  if (socketRef) {
    socketRef.disconnect();
    socketRef = null;
  }

  socketToken = token;
  socketRef = io(resolveSocketBaseUrl(), {
    transports: ['websocket'],
    reconnection: true,
    auth: {
      token,
    },
  });

  return socketRef;
}

export function disconnectRealtime(): void {
  if (!socketRef) {
    return;
  }

  socketRef.disconnect();
  socketRef = null;
  socketToken = null;
}

export function subscribeTicketRoom(socket: Socket, ticketId: string): void {
  socket.emit('subscribe.ticket', { ticketId });
}

export function unsubscribeTicketRoom(socket: Socket, ticketId: string): void {
  socket.emit('unsubscribe.ticket', { ticketId });
}

export function subscribeJobRoom(socket: Socket, jobId: string): void {
  socket.emit('subscribe.job', { jobId });
}

export function unsubscribeJobRoom(socket: Socket, jobId: string): void {
  socket.emit('unsubscribe.job', { jobId });
}

export function onRealtimeEvent<TPayload extends Record<string, unknown>>(
  socket: Socket,
  event: RealtimeEventName,
  handler: (payload: TPayload) => void,
): () => void {
  const wrapped = (payload: TPayload) => {
    handler(payload);
  };

  socket.on(event, wrapped);
  return () => {
    socket.off(event, wrapped);
  };
}

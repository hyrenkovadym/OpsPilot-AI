export const REALTIME_EVENTS = {
  ticketCreated: 'ticket.created',
  ticketUpdated: 'ticket.updated',
  ticketStatusUpdated: 'ticket.status.updated',
  ticketAssigned: 'ticket.assigned',
  ticketPriorityUpdated: 'ticket.priority.updated',
  jobQueued: 'job.queued',
  jobProcessing: 'job.processing',
  jobCompleted: 'job.completed',
  jobFailed: 'job.failed',
  ticketAiQueued: 'ticket.ai.queued',
  ticketAiProcessing: 'ticket.ai.processing',
  ticketAiCompleted: 'ticket.ai.completed',
  ticketAiFailed: 'ticket.ai.failed',
  knowledgeRechunkQueued: 'knowledge.rechunk.queued',
  knowledgeRechunkProcessing: 'knowledge.rechunk.processing',
  knowledgeRechunkCompleted: 'knowledge.rechunk.completed',
  knowledgeRechunkFailed: 'knowledge.rechunk.failed',
  auditCreated: 'audit.created',
} as const;

export type RealtimeEventName =
  (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

export const REALTIME_ROOMS = {
  supportAll: 'support:all',
  adminAll: 'admin:all',
  user: (userId: string) => `user:${userId}`,
  ticket: (ticketId: string) => `ticket:${ticketId}`,
  job: (jobId: string) => `job:${jobId}`,
} as const;

export interface RealtimeEmitOptions {
  rooms?: string[];
  broadcast?: boolean;
}

export interface RealtimeEventEnvelope {
  event: RealtimeEventName;
  payload: Record<string, unknown>;
  options: RealtimeEmitOptions;
  sourceInstanceId: string;
  timestamp: string;
}

export const REALTIME_CHANNEL = 'opspilot:realtime:events';

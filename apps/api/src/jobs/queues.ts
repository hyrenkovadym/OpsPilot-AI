export const QUEUE_NAMES = {
  ticketAi: 'ticket-ai',
  knowledgeBase: 'knowledge-base',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

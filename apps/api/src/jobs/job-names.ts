export const JOB_NAMES = {
  analyzeTicket: 'analyze-ticket',
  rechunkArticle: 'rechunk-article',
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

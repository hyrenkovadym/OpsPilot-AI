export interface AnalyzeTicketJobPayload {
  backgroundJobId: string;
  ticketId: string;
  actorId: string;
}

export interface RechunkArticleJobPayload {
  backgroundJobId: string;
  articleId: string;
  actorId: string;
}

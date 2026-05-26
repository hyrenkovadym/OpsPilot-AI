'use client';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api';

const ACCESS_TOKEN_KEY = 'opspilot_access_token';

export type UserRole = 'USER' | 'SUPPORT_AGENT' | 'ADMIN';
export type TicketStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'NEEDS_HUMAN_REVIEW'
  | 'RESOLVED'
  | 'REJECTED';
export type TicketCategory =
  | 'HR'
  | 'IT'
  | 'FINANCE'
  | 'OPERATIONS'
  | 'CUSTOMER_SUPPORT'
  | 'OTHER';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export interface TicketUserSummary {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}

export interface TicketDetail {
  id: string;
  title: string;
  description: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: TicketPriority;
  createdById: string;
  assignedToId: string | null;
  aiSummary: string | null;
  aiConfidence: number | null;
  aiRecommendedAction: string | null;
  aiContextSourcesJson: AiContextSource[] | null;
  createdAt: string;
  updatedAt: string;
  createdBy: TicketUserSummary;
  assignedTo: TicketUserSummary | null;
}

export interface AiContextSource {
  articleId: string;
  title: string;
  score: number;
}

export interface TicketAiSuggestion {
  category: TicketCategory;
  priority: TicketPriority;
  aiSummary: string;
  aiConfidence: number;
  recommendedAction: string;
  provider: 'mock' | 'openai';
  contextSources?: AiContextSource[] | null;
}

export interface TicketsListResponse {
  data: TicketDetail[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface TicketsQuery {
  status?: TicketStatus;
  category?: TicketCategory;
  priority?: TicketPriority;
  assignedToId?: string;
  createdById?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export type KnowledgeArticleStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  category: TicketCategory;
  status: KnowledgeArticleStatus;
  createdById: string;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
  chunksCount: number;
}

export interface KnowledgeArticlesListResponse {
  data: KnowledgeArticle[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface KnowledgeArticlesQuery {
  category?: TicketCategory;
  status?: KnowledgeArticleStatus;
  search?: string;
  includeNonPublished?: boolean;
  page?: number;
  limit?: number;
}

export interface KnowledgeSearchResult {
  articleId: string;
  articleTitle: string;
  category: TicketCategory;
  status: KnowledgeArticleStatus;
  chunkContent: string;
  score: number;
}

export interface KnowledgeSearchQuery {
  query?: string;
  category?: TicketCategory;
  includeNonPublished?: boolean;
  limit?: number;
}

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

function buildQueryString(query?: Record<string, unknown>): string {
  if (!query) {
    return '';
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (
      (typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean') &&
      `${value}`.trim().length > 0
    ) {
      params.set(key, `${value}`);
    }
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

async function requestJson<T>(
  path: string,
  init?: RequestInit,
  token?: string | null,
): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  headers.set('Content-Type', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (payload as { message?: string | string[] } | null)?.message ??
      `Request failed with status ${response.status}`;
    const normalizedMessage = Array.isArray(message) ? message.join(', ') : message;
    throw new ApiError(normalizedMessage, response.status, payload);
  }

  return payload as T;
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function saveAccessToken(token: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  return requestJson<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function register(input: {
  fullName: string;
  email: string;
  password: string;
}): Promise<AuthResponse> {
  return requestJson<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getCurrentUser(token: string): Promise<AuthUser> {
  return requestJson<AuthUser>('/auth/me', { method: 'GET' }, token);
}

export async function listTickets(
  token: string,
  query?: TicketsQuery,
): Promise<TicketsListResponse> {
  const queryString = buildQueryString(
    query as Record<string, unknown> | undefined,
  );
  return requestJson<TicketsListResponse>(`/tickets${queryString}`, { method: 'GET' }, token);
}

export async function getTicket(token: string, id: string): Promise<TicketDetail> {
  return requestJson<TicketDetail>(`/tickets/${id}`, { method: 'GET' }, token);
}

export async function createTicket(
  token: string,
  payload: {
    title: string;
    description: string;
    category: TicketCategory;
    priority: TicketPriority;
  },
): Promise<TicketDetail> {
  return requestJson<TicketDetail>(
    '/tickets',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    token,
  );
}

export async function updateTicketStatus(
  token: string,
  id: string,
  status: TicketStatus,
): Promise<TicketDetail> {
  return requestJson<TicketDetail>(
    `/tickets/${id}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    },
    token,
  );
}

export async function assignTicketTo(
  token: string,
  id: string,
  assignedToId?: string,
): Promise<TicketDetail> {
  return requestJson<TicketDetail>(
    `/tickets/${id}/assign`,
    {
      method: 'PATCH',
      body: JSON.stringify(
        assignedToId ? { assignedToId } : {},
      ),
    },
    token,
  );
}

export async function updateTicketPriority(
  token: string,
  id: string,
  priority: TicketPriority,
): Promise<TicketDetail> {
  return requestJson<TicketDetail>(
    `/tickets/${id}/priority`,
    {
      method: 'PATCH',
      body: JSON.stringify({ priority }),
    },
    token,
  );
}

export async function analyzeTicket(
  token: string,
  id: string,
): Promise<TicketAiSuggestion> {
  return requestJson<TicketAiSuggestion>(
    `/tickets/${id}/ai/analyze`,
    {
      method: 'POST',
    },
    token,
  );
}

export async function getTicketAiSuggestion(
  token: string,
  id: string,
): Promise<TicketAiSuggestion> {
  return requestJson<TicketAiSuggestion>(
    `/tickets/${id}/ai/suggestion`,
    {
      method: 'GET',
    },
    token,
  );
}

export async function listKnowledgeArticles(
  token: string,
  query?: KnowledgeArticlesQuery,
): Promise<KnowledgeArticlesListResponse> {
  const queryString = buildQueryString(
    query as Record<string, unknown> | undefined,
  );
  return requestJson<KnowledgeArticlesListResponse>(
    `/knowledge-base/articles${queryString}`,
    { method: 'GET' },
    token,
  );
}

export async function getKnowledgeArticle(
  token: string,
  id: string,
): Promise<KnowledgeArticle> {
  return requestJson<KnowledgeArticle>(
    `/knowledge-base/articles/${id}`,
    { method: 'GET' },
    token,
  );
}

export async function createKnowledgeArticle(
  token: string,
  payload: {
    title: string;
    content: string;
    category: TicketCategory;
  },
): Promise<KnowledgeArticle> {
  return requestJson<KnowledgeArticle>(
    '/knowledge-base/articles',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    token,
  );
}

export async function updateKnowledgeArticle(
  token: string,
  id: string,
  payload: {
    title?: string;
    content?: string;
    category?: TicketCategory;
  },
): Promise<KnowledgeArticle> {
  return requestJson<KnowledgeArticle>(
    `/knowledge-base/articles/${id}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
    token,
  );
}

export async function deleteKnowledgeArticle(
  token: string,
  id: string,
): Promise<void> {
  await requestJson<null>(
    `/knowledge-base/articles/${id}`,
    {
      method: 'DELETE',
    },
    token,
  );
}

export async function publishKnowledgeArticle(
  token: string,
  id: string,
): Promise<KnowledgeArticle> {
  return requestJson<KnowledgeArticle>(
    `/knowledge-base/articles/${id}/publish`,
    {
      method: 'POST',
    },
    token,
  );
}

export async function archiveKnowledgeArticle(
  token: string,
  id: string,
): Promise<KnowledgeArticle> {
  return requestJson<KnowledgeArticle>(
    `/knowledge-base/articles/${id}/archive`,
    {
      method: 'POST',
    },
    token,
  );
}

export async function rechunkKnowledgeArticle(
  token: string,
  id: string,
): Promise<KnowledgeArticle> {
  return requestJson<KnowledgeArticle>(
    `/knowledge-base/articles/${id}/rechunk`,
    {
      method: 'POST',
    },
    token,
  );
}

export async function searchKnowledgeBase(
  token: string,
  query: KnowledgeSearchQuery,
): Promise<KnowledgeSearchResult[]> {
  const queryString = buildQueryString(query as Record<string, unknown>);
  return requestJson<KnowledgeSearchResult[]>(
    `/knowledge-base/search${queryString}`,
    {
      method: 'GET',
    },
    token,
  );
}

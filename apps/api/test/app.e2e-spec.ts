import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AuditLog,
  BackgroundJob,
  BackgroundJobStatus,
  BackgroundJobType,
  KnowledgeArticleStatus,
  KnowledgeBaseArticle,
  KnowledgeBaseChunk,
  Prisma,
  Role,
  Ticket,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  User,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AiService } from '../src/ai/ai.service';
import { AppModule } from '../src/app.module';
import { JobsService } from '../src/jobs/jobs.service';
import { KnowledgeBaseService } from '../src/knowledge-base/knowledge-base.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RealtimeService } from '../src/realtime/realtime.service';
import { TicketsService } from '../src/tickets/tickets.service';

interface AuthPayload {
  accessToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: Role;
  };
}

interface TicketListResponse {
  data: Array<{ id: string; createdById: string; status: TicketStatus }>;
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface KnowledgeListResponse {
  data: Array<{
    id: string;
    title: string;
    category: TicketCategory;
    status: KnowledgeArticleStatus;
    chunksCount: number;
  }>;
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

type UserSummary = Pick<User, 'id' | 'email' | 'fullName' | 'role'>;
type TicketWithUsers = Ticket & {
  createdBy: UserSummary;
  assignedTo: UserSummary | null;
};

type KnowledgeArticleWithChunks = KnowledgeBaseArticle & {
  chunks: KnowledgeBaseChunk[];
  _count?: {
    chunks: number;
  };
};

class MockPrismaService {
  public readonly users: User[] = [];
  public readonly tickets: Ticket[] = [];
  public readonly auditLogs: AuditLog[] = [];
  public readonly backgroundJobs: BackgroundJob[] = [];
  public readonly knowledgeArticles: KnowledgeBaseArticle[] = [];
  public readonly knowledgeChunks: KnowledgeBaseChunk[] = [];

  private mapUserSummary(user: User): UserSummary {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };
  }

  private enrichTicket(ticket: Ticket): TicketWithUsers {
    const createdBy = this.users.find((user) => user.id === ticket.createdById);
    if (!createdBy) {
      throw new Error('createdBy user was not found in mock store');
    }

    const assignedTo = ticket.assignedToId
      ? (this.users.find((user) => user.id === ticket.assignedToId) ?? null)
      : null;

    return {
      ...ticket,
      createdBy: this.mapUserSummary(createdBy),
      assignedTo: assignedTo ? this.mapUserSummary(assignedTo) : null,
    };
  }

  private applyTicketWhere(
    tickets: Ticket[],
    where?: {
      createdById?: string;
      assignedToId?: string;
      status?: TicketStatus;
      priority?: TicketPriority;
      category?: TicketCategory;
      OR?: Array<{
        title?: { contains: string; mode?: 'insensitive' };
        description?: { contains: string; mode?: 'insensitive' };
      }>;
    },
  ): Ticket[] {
    if (!where) {
      return [...tickets];
    }

    return tickets.filter((ticket) => {
      if (where.createdById && ticket.createdById !== where.createdById) {
        return false;
      }
      if (where.assignedToId && ticket.assignedToId !== where.assignedToId) {
        return false;
      }
      if (where.status && ticket.status !== where.status) {
        return false;
      }
      if (where.priority && ticket.priority !== where.priority) {
        return false;
      }
      if (where.category && ticket.category !== where.category) {
        return false;
      }

      if (where.OR && where.OR.length > 0) {
        const matches = where.OR.some((clause) => {
          if (clause.title?.contains) {
            return ticket.title
              .toLowerCase()
              .includes(clause.title.contains.toLowerCase());
          }

          if (clause.description?.contains) {
            return ticket.description
              .toLowerCase()
              .includes(clause.description.contains.toLowerCase());
          }

          return false;
        });

        if (!matches) {
          return false;
        }
      }

      return true;
    });
  }

  private applyArticleWhere(
    articles: KnowledgeBaseArticle[],
    where?: {
      status?: KnowledgeArticleStatus;
      category?: TicketCategory;
      OR?: Array<{
        title?: { contains: string; mode?: 'insensitive' };
        content?: { contains: string; mode?: 'insensitive' };
      }>;
    },
  ): KnowledgeBaseArticle[] {
    if (!where) {
      return [...articles];
    }

    return articles.filter((article) => {
      if (where.status && article.status !== where.status) {
        return false;
      }
      if (where.category && article.category !== where.category) {
        return false;
      }

      if (where.OR && where.OR.length > 0) {
        const matches = where.OR.some((clause) => {
          if (clause.title?.contains) {
            return article.title
              .toLowerCase()
              .includes(clause.title.contains.toLowerCase());
          }
          if (clause.content?.contains) {
            return article.content
              .toLowerCase()
              .includes(clause.content.contains.toLowerCase());
          }
          return false;
        });

        if (!matches) {
          return false;
        }
      }

      return true;
    });
  }

  private mapArticleWithChunks(
    article: KnowledgeBaseArticle,
    includeCount: boolean,
  ): KnowledgeArticleWithChunks {
    const chunks = this.knowledgeChunks
      .filter((chunk) => chunk.articleId === article.id)
      .sort((a, b) => a.chunkIndex - b.chunkIndex);
    return {
      ...article,
      chunks,
      ...(includeCount ? { _count: { chunks: chunks.length } } : {}),
    };
  }

  public user = {
    findUnique: async (args: {
      where: { id?: string; email?: string };
      select?: {
        id?: boolean;
        role?: boolean;
      };
    }): Promise<User | { id: string; role: Role } | null> => {
      const user = args.where.id
        ? (this.users.find((item) => item.id === args.where.id) ?? null)
        : (this.users.find((item) => item.email === args.where.email) ?? null);

      if (!user) {
        return null;
      }

      if (args.select) {
        return {
          id: user.id,
          role: user.role,
        };
      }

      return user;
    },
    create: async (args: {
      data: {
        email: string;
        passwordHash: string;
        fullName: string;
        role?: Role;
      };
    }): Promise<User> => {
      const now = new Date();
      const user: User = {
        id: randomUUID(),
        email: args.data.email,
        passwordHash: args.data.passwordHash,
        fullName: args.data.fullName,
        role: args.data.role ?? Role.USER,
        createdAt: now,
        updatedAt: now,
      };

      this.users.push(user);
      return user;
    },
  };

  public ticket = {
    create: async (args: {
      data: {
        title: string;
        description: string;
        category: TicketCategory;
        priority: TicketPriority;
        status: TicketStatus;
        createdById: string;
        assignedToId?: string | null;
      };
      include?: unknown;
    }): Promise<Ticket | TicketWithUsers> => {
      const now = new Date();
      const ticket: Ticket = {
        id: randomUUID(),
        title: args.data.title,
        description: args.data.description,
        category: args.data.category,
        status: args.data.status,
        priority: args.data.priority,
        createdById: args.data.createdById,
        assignedToId: args.data.assignedToId ?? null,
        aiSummary: null,
        aiConfidence: null,
        aiRecommendedAction: null,
        aiContextSourcesJson: null,
        createdAt: now,
        updatedAt: now,
      };

      this.tickets.push(ticket);
      return args.include ? this.enrichTicket(ticket) : ticket;
    },
    findMany: async (args: {
      where?: {
        createdById?: string;
        assignedToId?: string;
        status?: TicketStatus;
        priority?: TicketPriority;
        category?: TicketCategory;
        OR?: Array<{
          title?: { contains: string; mode?: 'insensitive' };
          description?: { contains: string; mode?: 'insensitive' };
        }>;
      };
      include?: unknown;
      orderBy?: { createdAt: 'asc' | 'desc' };
      skip?: number;
      take?: number;
    }): Promise<Array<Ticket | TicketWithUsers>> => {
      const filtered = this.applyTicketWhere(this.tickets, args.where);
      const ordered =
        args.orderBy?.createdAt === 'desc'
          ? filtered.sort(
              (first, second) =>
                second.createdAt.getTime() - first.createdAt.getTime(),
            )
          : filtered;

      const skip = args.skip ?? 0;
      const take = args.take ?? ordered.length;
      const paged = ordered.slice(skip, skip + take);

      if (args.include) {
        return paged.map((ticket) => this.enrichTicket(ticket));
      }

      return paged;
    },
    count: async (args: {
      where?: {
        createdById?: string;
        assignedToId?: string;
        status?: TicketStatus;
        priority?: TicketPriority;
        category?: TicketCategory;
        OR?: Array<{
          title?: { contains: string; mode?: 'insensitive' };
          description?: { contains: string; mode?: 'insensitive' };
        }>;
      };
    }): Promise<number> => {
      return this.applyTicketWhere(this.tickets, args.where).length;
    },
    findUnique: async (args: {
      where: { id: string };
      include?: unknown;
    }): Promise<Ticket | TicketWithUsers | null> => {
      const ticket = this.tickets.find((item) => item.id === args.where.id);
      if (!ticket) {
        return null;
      }

      return args.include ? this.enrichTicket(ticket) : ticket;
    },
    update: async (args: {
      where: { id: string };
      data: {
        title?: string;
        description?: string;
        category?: TicketCategory;
        priority?: TicketPriority;
        status?: TicketStatus;
        assignedToId?: string;
        aiSummary?: string;
        aiConfidence?: number;
        aiRecommendedAction?: string;
        aiContextSourcesJson?: Prisma.InputJsonValue;
      };
      include?: unknown;
    }): Promise<Ticket | TicketWithUsers> => {
      const index = this.tickets.findIndex((item) => item.id === args.where.id);
      if (index < 0) {
        throw new Error('Ticket not found in mock update');
      }

      const existing = this.tickets[index];
      const updated: Ticket = {
        ...existing,
        ...args.data,
        aiContextSourcesJson:
          args.data.aiContextSourcesJson === undefined
            ? existing.aiContextSourcesJson
            : args.data.aiContextSourcesJson,
        updatedAt: new Date(),
      };

      this.tickets[index] = updated;
      return args.include ? this.enrichTicket(updated) : updated;
    },
  };

  public knowledgeBaseArticle = {
    create: async (args: {
      data: {
        title: string;
        content: string;
        category: TicketCategory;
        status: KnowledgeArticleStatus;
        createdById: string;
        updatedById?: string | null;
        chunks?: {
          createMany: {
            data: Array<{
              chunkIndex: number;
              content: string;
              tokensEstimate?: number | null;
              embeddingJson?: Prisma.JsonValue | null;
            }>;
          };
        };
      };
      include?: { _count?: { select: { chunks: boolean } } };
    }): Promise<KnowledgeArticleWithChunks> => {
      const now = new Date();
      const article: KnowledgeBaseArticle = {
        id: randomUUID(),
        title: args.data.title,
        content: args.data.content,
        category: args.data.category,
        status: args.data.status,
        createdById: args.data.createdById,
        updatedById: args.data.updatedById ?? null,
        createdAt: now,
        updatedAt: now,
      };

      this.knowledgeArticles.push(article);

      const chunkData = args.data.chunks?.createMany.data ?? [];
      for (const chunk of chunkData) {
        this.knowledgeChunks.push({
          id: randomUUID(),
          articleId: article.id,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          tokensEstimate: chunk.tokensEstimate ?? null,
          embeddingJson: (chunk.embeddingJson as Prisma.JsonValue) ?? null,
          createdAt: now,
        });
      }

      return this.mapArticleWithChunks(article, Boolean(args.include?._count));
    },
    findMany: async (args: {
      where?: {
        status?: KnowledgeArticleStatus;
        category?: TicketCategory;
        OR?: Array<{
          title?: { contains: string; mode?: 'insensitive' };
          content?: { contains: string; mode?: 'insensitive' };
        }>;
      };
      include?: { chunks?: boolean; _count?: { select: { chunks: boolean } } };
      orderBy?: { updatedAt: 'asc' | 'desc' };
      skip?: number;
      take?: number;
    }): Promise<KnowledgeArticleWithChunks[]> => {
      const filtered = this.applyArticleWhere(
        this.knowledgeArticles,
        args.where,
      );
      const ordered = [...filtered].sort((a, b) =>
        args.orderBy?.updatedAt === 'asc'
          ? a.updatedAt.getTime() - b.updatedAt.getTime()
          : b.updatedAt.getTime() - a.updatedAt.getTime(),
      );
      const skip = args.skip ?? 0;
      const take = args.take ?? ordered.length;
      const paged = ordered.slice(skip, skip + take);
      return paged.map((article) =>
        this.mapArticleWithChunks(article, Boolean(args.include?._count)),
      );
    },
    count: async (args: {
      where?: {
        status?: KnowledgeArticleStatus;
        category?: TicketCategory;
        OR?: Array<{
          title?: { contains: string; mode?: 'insensitive' };
          content?: { contains: string; mode?: 'insensitive' };
        }>;
      };
    }): Promise<number> => {
      return this.applyArticleWhere(this.knowledgeArticles, args.where).length;
    },
    findUnique: async (args: {
      where: { id: string };
      include?: { _count?: { select: { chunks: boolean } } };
    }): Promise<KnowledgeArticleWithChunks | null> => {
      const article = this.knowledgeArticles.find(
        (item) => item.id === args.where.id,
      );
      if (!article) {
        return null;
      }
      return this.mapArticleWithChunks(article, Boolean(args.include?._count));
    },
    update: async (args: {
      where: { id: string };
      data: {
        title?: string;
        content?: string;
        category?: TicketCategory;
        status?: KnowledgeArticleStatus;
        updatedById?: string | null;
        updatedBy?: {
          connect: { id: string };
        };
      };
      include?: { _count?: { select: { chunks: boolean } } };
    }): Promise<KnowledgeArticleWithChunks> => {
      const index = this.knowledgeArticles.findIndex(
        (item) => item.id === args.where.id,
      );
      if (index < 0) {
        throw new Error('Knowledge article not found in mock update');
      }
      const existing = this.knowledgeArticles[index];
      const updated: KnowledgeBaseArticle = {
        ...existing,
        title: args.data.title ?? existing.title,
        content: args.data.content ?? existing.content,
        category: args.data.category ?? existing.category,
        status: args.data.status ?? existing.status,
        updatedById:
          args.data.updatedBy?.connect.id ??
          (args.data.updatedById === undefined
            ? existing.updatedById
            : args.data.updatedById),
        updatedAt: new Date(),
      };
      this.knowledgeArticles[index] = updated;
      return this.mapArticleWithChunks(updated, Boolean(args.include?._count));
    },
    delete: async (args: {
      where: { id: string };
    }): Promise<KnowledgeBaseArticle> => {
      const index = this.knowledgeArticles.findIndex(
        (item) => item.id === args.where.id,
      );
      if (index < 0) {
        throw new Error('Knowledge article not found in mock delete');
      }
      const [deleted] = this.knowledgeArticles.splice(index, 1);
      this.knowledgeChunks.splice(
        0,
        this.knowledgeChunks.length,
        ...this.knowledgeChunks.filter(
          (chunk) => chunk.articleId !== deleted.id,
        ),
      );
      return deleted;
    },
  };

  public knowledgeBaseChunk = {
    deleteMany: async (args: {
      where: { articleId: string };
    }): Promise<{ count: number }> => {
      const before = this.knowledgeChunks.length;
      this.knowledgeChunks.splice(
        0,
        this.knowledgeChunks.length,
        ...this.knowledgeChunks.filter(
          (chunk) => chunk.articleId !== args.where.articleId,
        ),
      );
      return { count: before - this.knowledgeChunks.length };
    },
    createMany: async (args: {
      data: Array<{
        articleId: string;
        chunkIndex: number;
        content: string;
        tokensEstimate?: number | null;
        embeddingJson?: Prisma.JsonValue | null;
      }>;
    }): Promise<{ count: number }> => {
      const now = new Date();
      for (const chunk of args.data) {
        this.knowledgeChunks.push({
          id: randomUUID(),
          articleId: chunk.articleId,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          tokensEstimate: chunk.tokensEstimate ?? null,
          embeddingJson: (chunk.embeddingJson as Prisma.JsonValue) ?? null,
          createdAt: now,
        });
      }
      return { count: args.data.length };
    },
  };

  public auditLog = {
    create: async (args: {
      data: {
        actorId?: string | null;
        action: string;
        entityType: string;
        entityId: string;
        metadata: unknown;
      };
    }): Promise<AuditLog> => {
      const log: AuditLog = {
        id: randomUUID(),
        actorId: args.data.actorId ?? null,
        action: args.data.action,
        entityType: args.data.entityType,
        entityId: args.data.entityId,
        metadata: args.data.metadata as object,
        createdAt: new Date(),
      };
      this.auditLogs.push(log);
      return log;
    },
  };

  public backgroundJob = {
    create: async (args: {
      data: {
        type: BackgroundJobType;
        status: BackgroundJobStatus;
        entityType: string;
        entityId: string;
        attempts?: number;
        metadata?: Prisma.JsonValue;
      };
    }): Promise<BackgroundJob> => {
      const job: BackgroundJob = {
        id: randomUUID(),
        type: args.data.type,
        status: args.data.status,
        entityType: args.data.entityType,
        entityId: args.data.entityId,
        attempts: args.data.attempts ?? 0,
        lastError: null,
        metadata: args.data.metadata ?? null,
        createdAt: new Date(),
        startedAt: null,
        finishedAt: null,
      };
      this.backgroundJobs.push(job);
      return job;
    },
    update: async (args: {
      where: { id: string };
      data: {
        status?: BackgroundJobStatus;
        attempts?: number;
        lastError?: string;
        metadata?: Prisma.InputJsonValue;
        startedAt?: Date;
        finishedAt?: Date;
      };
    }): Promise<BackgroundJob> => {
      const index = this.backgroundJobs.findIndex(
        (item) => item.id === args.where.id,
      );
      if (index < 0) {
        throw new Error('BackgroundJob not found in mock update');
      }

      const existing = this.backgroundJobs[index];
      const updated: BackgroundJob = {
        ...existing,
        status: args.data.status ?? existing.status,
        attempts: args.data.attempts ?? existing.attempts,
        lastError:
          args.data.lastError === undefined
            ? existing.lastError
            : args.data.lastError,
        metadata:
          args.data.metadata === undefined
            ? existing.metadata
            : (args.data.metadata as Prisma.JsonValue),
        startedAt:
          args.data.startedAt === undefined
            ? existing.startedAt
            : args.data.startedAt,
        finishedAt:
          args.data.finishedAt === undefined
            ? existing.finishedAt
            : args.data.finishedAt,
      };
      this.backgroundJobs[index] = updated;
      return updated;
    },
    findUnique: async (args: {
      where: { id: string };
    }): Promise<BackgroundJob | null> => {
      return (
        this.backgroundJobs.find((item) => item.id === args.where.id) ?? null
      );
    },
    findMany: async (args: {
      where?: {
        entityType?: string;
        entityId?: string;
      };
      orderBy?: { createdAt: 'asc' | 'desc' };
      take?: number;
    }): Promise<BackgroundJob[]> => {
      const filtered = this.backgroundJobs.filter((item) => {
        if (
          args.where?.entityType &&
          item.entityType !== args.where.entityType
        ) {
          return false;
        }
        if (args.where?.entityId && item.entityId !== args.where.entityId) {
          return false;
        }
        return true;
      });
      const ordered = [...filtered].sort((a, b) =>
        args.orderBy?.createdAt === 'asc'
          ? a.createdAt.getTime() - b.createdAt.getTime()
          : b.createdAt.getTime() - a.createdAt.getTime(),
      );
      return ordered.slice(0, args.take ?? ordered.length);
    },
  };

  public async $queryRaw(
    _query: TemplateStringsArray,
  ): Promise<Array<{ ok: number }>> {
    return [{ ok: 1 }];
  }

  public async $connect(): Promise<void> {
    return Promise.resolve();
  }

  public async $disconnect(): Promise<void> {
    return Promise.resolve();
  }
}

describe('OpsPilot API Phase 3 (e2e)', () => {
  let app: INestApplication;
  let mockPrisma: MockPrismaService;
  let aiService: AiService;
  let jobsService: JobsService;
  let ticketsService: TicketsService;
  let knowledgeBaseService: KnowledgeBaseService;
  let realtimeService: RealtimeService;

  beforeAll(async () => {
    mockPrisma = new MockPrismaService();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    aiService = app.get(AiService);
    jobsService = app.get(JobsService);
    ticketsService = app.get(TicketsService);
    knowledgeBaseService = app.get(KnowledgeBaseService);
    realtimeService = app.get(RealtimeService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('user creates ticket', async () => {
    const publishSpy = jest
      .spyOn(realtimeService, 'publish')
      .mockResolvedValue(undefined);

    const user = await register('ticket.creator@company.com', 'Ticket Creator');
    const response = await createTicket(user.accessToken, {
      title: 'Need laptop replacement',
      description: 'Laptop no longer starts after security patch update.',
      category: 'IT',
      priority: 'HIGH',
    });

    expect(response.status).toBe(201);
    expect(response.body.title).toBe('Need laptop replacement');
    expect(response.body.createdById).toBe(user.user.id);
    expect(
      publishSpy.mock.calls.some((call) => call[0] === 'ticket.created'),
    ).toBe(true);
    publishSpy.mockRestore();
  });

  it('user sees only own tickets', async () => {
    const firstUser = await register('tickets.owner1@company.com', 'Owner One');
    const secondUser = await register(
      'tickets.owner2@company.com',
      'Owner Two',
    );

    await createTicket(firstUser.accessToken, {
      title: 'First user ticket',
      description: 'Ticket belongs to first user.',
      category: 'OPERATIONS',
      priority: 'LOW',
    });
    await createTicket(secondUser.accessToken, {
      title: 'Second user ticket',
      description: 'Ticket belongs to second user.',
      category: 'HR',
      priority: 'MEDIUM',
    });

    const response = await request(app.getHttpServer())
      .get('/api/tickets')
      .set('Authorization', `Bearer ${firstUser.accessToken}`)
      .expect(200);

    const body = response.body as TicketListResponse;
    expect(body.data.length).toBeGreaterThan(0);
    expect(
      body.data.every((item) => item.createdById === firstUser.user.id),
    ).toBe(true);
  });

  it('user cannot see another user ticket', async () => {
    const owner = await register('ticket.owner@company.com', 'Owner User');
    const outsider = await register(
      'ticket.outsider@company.com',
      'Outsider User',
    );

    const created = await createTicket(owner.accessToken, {
      title: 'Owner private ticket',
      description: 'This ticket should remain hidden from outsider.',
      category: 'FINANCE',
      priority: 'MEDIUM',
    });

    await request(app.getHttpServer())
      .get(`/api/tickets/${created.body.id as string}`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .expect(404);
  });

  it('support agent sees all tickets', async () => {
    const userOne = await register('all.agent.user1@company.com', 'User One');
    const userTwo = await register('all.agent.user2@company.com', 'User Two');
    const support = await register(
      'agent.viewer@company.com',
      'Support Viewer',
    );
    setRole(support.user.email, Role.SUPPORT_AGENT);
    const supportLogin = await login('agent.viewer@company.com');

    const firstTicket = await createTicket(userOne.accessToken, {
      title: 'Agent visibility one',
      description: 'Created by user one.',
      category: 'IT',
      priority: 'LOW',
    });
    const secondTicket = await createTicket(userTwo.accessToken, {
      title: 'Agent visibility two',
      description: 'Created by user two.',
      category: 'CUSTOMER_SUPPORT',
      priority: 'HIGH',
    });

    const response = await request(app.getHttpServer())
      .get('/api/tickets')
      .set('Authorization', `Bearer ${supportLogin.accessToken}`)
      .expect(200);

    const body = response.body as TicketListResponse;
    const ids = body.data.map((ticket) => ticket.id);
    expect(ids).toContain(firstTicket.body.id as string);
    expect(ids).toContain(secondTicket.body.id as string);
  });

  it('admin sees all tickets', async () => {
    const regularUser = await register(
      'admin.scope.user@company.com',
      'Scope User',
    );
    const admin = await register('admin.scope@company.com', 'Scope Admin');
    setRole(admin.user.email, Role.ADMIN);
    const adminLogin = await login('admin.scope@company.com');

    const createdTicket = await createTicket(regularUser.accessToken, {
      title: 'Admin visibility ticket',
      description: 'Ticket visible to admin.',
      category: 'OTHER',
      priority: 'MEDIUM',
    });

    const response = await request(app.getHttpServer())
      .get('/api/tickets')
      .set('Authorization', `Bearer ${adminLogin.accessToken}`)
      .expect(200);

    const body = response.body as TicketListResponse;
    const ids = body.data.map((ticket) => ticket.id);
    expect(ids).toContain(createdTicket.body.id as string);
  });

  it('support agent updates status', async () => {
    const publishSpy = jest
      .spyOn(realtimeService, 'publish')
      .mockResolvedValue(undefined);

    const user = await register('status.owner@company.com', 'Status Owner');
    const support = await register('status.agent@company.com', 'Status Agent');
    setRole(support.user.email, Role.SUPPORT_AGENT);
    const supportLogin = await login('status.agent@company.com');

    const created = await createTicket(user.accessToken, {
      title: 'Status update test',
      description: 'Ticket to be moved to in progress.',
      category: 'IT',
      priority: 'MEDIUM',
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/tickets/${created.body.id as string}/status`)
      .set('Authorization', `Bearer ${supportLogin.accessToken}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(200);

    expect(response.body.status).toBe('IN_PROGRESS');
    expect(
      publishSpy.mock.calls.some((call) => call[0] === 'ticket.status.updated'),
    ).toBe(true);
    publishSpy.mockRestore();
  });

  it('user cannot update status to non-resolved state', async () => {
    const user = await register('status.denied@company.com', 'Denied User');
    const created = await createTicket(user.accessToken, {
      title: 'User status denied test',
      description: 'User should not move this ticket to in progress.',
      category: 'HR',
      priority: 'LOW',
    });

    await request(app.getHttpServer())
      .patch(`/api/tickets/${created.body.id as string}/status`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(403);
  });

  it('support agent assigns ticket', async () => {
    const user = await register('assign.owner@company.com', 'Assign Owner');
    const support = await register('assign.agent@company.com', 'Assign Agent');
    setRole(support.user.email, Role.SUPPORT_AGENT);
    const supportLogin = await login('assign.agent@company.com');

    const created = await createTicket(user.accessToken, {
      title: 'Assignment test ticket',
      description: 'Ticket to assign to support agent.',
      category: 'OPERATIONS',
      priority: 'HIGH',
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/tickets/${created.body.id as string}/assign`)
      .set('Authorization', `Bearer ${supportLogin.accessToken}`)
      .send({ assignedToId: support.user.id })
      .expect(200);

    expect(response.body.assignedToId).toBe(support.user.id);
  });

  it('audit events are created for lifecycle changes', async () => {
    const user = await register('audit.owner@company.com', 'Audit Owner');
    const support = await register('audit.agent@company.com', 'Audit Agent');
    setRole(support.user.email, Role.SUPPORT_AGENT);
    const supportLogin = await login('audit.agent@company.com');

    const created = await createTicket(user.accessToken, {
      title: 'Audit lifecycle ticket',
      description: 'Track assign, priority, and status events.',
      category: 'IT',
      priority: 'LOW',
    });

    await request(app.getHttpServer())
      .patch(`/api/tickets/${created.body.id as string}/assign`)
      .set('Authorization', `Bearer ${supportLogin.accessToken}`)
      .send({ assignedToId: support.user.id })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/tickets/${created.body.id as string}/priority`)
      .set('Authorization', `Bearer ${supportLogin.accessToken}`)
      .send({ priority: 'HIGH' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/tickets/${created.body.id as string}/status`)
      .set('Authorization', `Bearer ${supportLogin.accessToken}`)
      .send({ status: 'RESOLVED' })
      .expect(200);

    const actions = mockPrisma.auditLogs.map((log) => log.action);
    expect(actions).toContain('ticket_assigned');
    expect(actions).toContain('ticket_priority_updated');
    expect(actions).toContain('ticket_resolved');
  });

  it('filters and pagination work', async () => {
    const user = await register('filter.owner@company.com', 'Filter Owner');
    const support = await register('filter.agent@company.com', 'Filter Agent');
    setRole(support.user.email, Role.SUPPORT_AGENT);
    const supportLogin = await login('filter.agent@company.com');

    await createTicket(user.accessToken, {
      title: 'Filter open alpha',
      description: 'Alpha ticket in open status',
      category: 'IT',
      priority: 'LOW',
    });
    const second = await createTicket(user.accessToken, {
      title: 'Filter open beta',
      description: 'Beta ticket that will be resolved',
      category: 'IT',
      priority: 'MEDIUM',
    });

    await request(app.getHttpServer())
      .patch(`/api/tickets/${second.body.id as string}/status`)
      .set('Authorization', `Bearer ${supportLogin.accessToken}`)
      .send({ status: 'RESOLVED' })
      .expect(200);

    const pagedResponse = await request(app.getHttpServer())
      .get('/api/tickets')
      .set('Authorization', `Bearer ${supportLogin.accessToken}`)
      .query({ status: 'OPEN', page: 1, limit: 1, search: 'filter open' })
      .expect(200);

    const body = pagedResponse.body as TicketListResponse;
    expect(body.meta.limit).toBe(1);
    expect(body.meta.page).toBe(1);
    expect(body.data.length).toBe(1);
    expect(body.data[0].status).toBe('OPEN');
  });

  it('authenticated user can analyze own ticket', async () => {
    const user = await register('ai.owner@company.com', 'AI Owner');
    const created = await createTicket(user.accessToken, {
      title: 'urgent vpn login issue',
      description: 'User is blocked and cannot access production VPN.',
      category: 'OTHER',
      priority: 'LOW',
    });

    const response = await request(app.getHttpServer())
      .post(`/api/tickets/${created.body.id as string}/ai/analyze`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(201);

    expect(response.body.category).toBe('IT');
    expect(response.body.priority).toBe('HIGH');
    expect(response.body.aiSummary).toContain('urgent vpn login issue');
    expect(response.body.aiConfidence).toBeGreaterThan(0);
  });

  it('user cannot analyze another user ticket', async () => {
    const owner = await register('ai.owner2@company.com', 'AI Owner 2');
    const outsider = await register('ai.outsider@company.com', 'AI Outsider');
    const created = await createTicket(owner.accessToken, {
      title: 'finance invoice mismatch',
      description: 'Invoice reconciliation has a payment mismatch.',
      category: 'OTHER',
      priority: 'LOW',
    });

    await request(app.getHttpServer())
      .post(`/api/tickets/${created.body.id as string}/ai/analyze`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .expect(404);
  });

  it('support agent can analyze any ticket', async () => {
    const owner = await register(
      'ai.support.owner@company.com',
      'Support Owner',
    );
    const support = await register('ai.support@company.com', 'Support Agent');
    setRole(support.user.email, Role.SUPPORT_AGENT);
    const supportLogin = await login('ai.support@company.com');
    const created = await createTicket(owner.accessToken, {
      title: 'payroll issue',
      description: 'Need salary adjustment after payroll error.',
      category: 'OTHER',
      priority: 'LOW',
    });

    const response = await request(app.getHttpServer())
      .post(`/api/tickets/${created.body.id as string}/ai/analyze`)
      .set('Authorization', `Bearer ${supportLogin.accessToken}`)
      .expect(201);

    expect(response.body.category).toBe('FINANCE');
  });

  it('admin can analyze any ticket', async () => {
    const owner = await register('ai.admin.owner@company.com', 'Admin Owner');
    const admin = await register('ai.admin@company.com', 'Admin User');
    setRole(admin.user.email, Role.ADMIN);
    const adminLogin = await login('ai.admin@company.com');
    const created = await createTicket(owner.accessToken, {
      title: 'operations schedule update',
      description: 'Process schedule needs logistics coordination.',
      category: 'OTHER',
      priority: 'LOW',
    });

    const response = await request(app.getHttpServer())
      .post(`/api/tickets/${created.body.id as string}/ai/analyze`)
      .set('Authorization', `Bearer ${adminLogin.accessToken}`)
      .expect(201);

    expect(response.body.category).toBe('OPERATIONS');
  });

  it('suggestion endpoint returns AI fields', async () => {
    const user = await register(
      'ai.suggestion@company.com',
      'Suggestion Owner',
    );
    const created = await createTicket(user.accessToken, {
      title: 'client support problem',
      description: 'Customer support case with urgent complaint.',
      category: 'OTHER',
      priority: 'LOW',
    });

    await request(app.getHttpServer())
      .post(`/api/tickets/${created.body.id as string}/ai/analyze`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(201);

    const response = await request(app.getHttpServer())
      .get(`/api/tickets/${created.body.id as string}/ai/suggestion`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);

    expect(response.body.aiSummary).toBeTruthy();
    expect(response.body.aiConfidence).toBeGreaterThan(0);
    expect(response.body.recommendedAction).toBeTruthy();
    expect(response.body.provider).toBe('mock');
  });

  it('ticket_ai_analyzed audit event is created', async () => {
    const user = await register('ai.audit@company.com', 'AI Audit User');
    const created = await createTicket(user.accessToken, {
      title: 'hr onboarding request',
      description: 'New employee needs onboarding policy packet.',
      category: 'OTHER',
      priority: 'LOW',
    });

    await request(app.getHttpServer())
      .post(`/api/tickets/${created.body.id as string}/ai/analyze`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(201);

    const actionNames = mockPrisma.auditLogs.map((entry) => entry.action);
    expect(actionNames).toContain('ticket_ai_analyzed');
  });

  it('AI provider failure returns safe error and writes audit', async () => {
    const user = await register('ai.fail@company.com', 'AI Failure User');
    const created = await createTicket(user.accessToken, {
      title: 'ai failure case',
      description: 'Used to test failure path.',
      category: 'OTHER',
      priority: 'LOW',
    });

    const analyzeSpy = jest
      .spyOn(aiService, 'analyzeTicket')
      .mockRejectedValueOnce(new Error('provider down'));

    await request(app.getHttpServer())
      .post(`/api/tickets/${created.body.id as string}/ai/analyze`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(502);

    analyzeSpy.mockRestore();

    const failureLogs = mockPrisma.auditLogs.filter(
      (entry) => entry.action === 'ticket_ai_analysis_failed',
    );
    expect(failureLogs.length).toBeGreaterThan(0);
  });

  it('USER cannot create knowledge article', async () => {
    const user = await register('kb.user.denied@company.com', 'KB User');

    await request(app.getHttpServer())
      .post('/api/knowledge-base/articles')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        title: 'User should not create article',
        content: 'Draft policy content.',
        category: 'HR',
      })
      .expect(403);
  });

  it('SUPPORT_AGENT can create, update, publish, archive and rechunk article', async () => {
    const support = await register('kb.agent@company.com', 'KB Agent');
    setRole(support.user.email, Role.SUPPORT_AGENT);
    const supportLogin = await login('kb.agent@company.com');

    const created = await request(app.getHttpServer())
      .post('/api/knowledge-base/articles')
      .set('Authorization', `Bearer ${supportLogin.accessToken}`)
      .send({
        title: 'IT access troubleshooting',
        content:
          'If dashboard access is blocked, verify account lock, reset SSO, and collect VPN logs.',
        category: 'IT',
      })
      .expect(201);

    expect(created.body.status).toBe('DRAFT');
    expect(created.body.chunksCount).toBeGreaterThan(0);

    const updated = await request(app.getHttpServer())
      .patch(`/api/knowledge-base/articles/${created.body.id as string}`)
      .set('Authorization', `Bearer ${supportLogin.accessToken}`)
      .send({
        content:
          'If dashboard access is blocked, verify account lock, reset SSO, and collect VPN logs. Escalate if still blocked.',
      })
      .expect(200);

    expect(updated.body.content).toContain('Escalate if still blocked');

    const published = await request(app.getHttpServer())
      .post(`/api/knowledge-base/articles/${created.body.id as string}/publish`)
      .set('Authorization', `Bearer ${supportLogin.accessToken}`)
      .expect(201);

    expect(published.body.status).toBe('PUBLISHED');

    const rechunked = await request(app.getHttpServer())
      .post(`/api/knowledge-base/articles/${created.body.id as string}/rechunk`)
      .set('Authorization', `Bearer ${supportLogin.accessToken}`)
      .expect(201);

    expect(rechunked.body.chunksCount).toBeGreaterThan(0);

    const archived = await request(app.getHttpServer())
      .post(`/api/knowledge-base/articles/${created.body.id as string}/archive`)
      .set('Authorization', `Bearer ${supportLogin.accessToken}`)
      .expect(201);

    expect(archived.body.status).toBe('ARCHIVED');
  });

  it('ADMIN can create knowledge article', async () => {
    const admin = await register('kb.admin@company.com', 'KB Admin');
    setRole(admin.user.email, Role.ADMIN);
    const adminLogin = await login('kb.admin@company.com');

    await request(app.getHttpServer())
      .post('/api/knowledge-base/articles')
      .set('Authorization', `Bearer ${adminLogin.accessToken}`)
      .send({
        title: 'Finance expense reimbursement policy',
        content: 'Submit receipts within 10 business days for reimbursement.',
        category: 'FINANCE',
      })
      .expect(201);
  });

  it('USER cannot update/publish/archive knowledge article', async () => {
    const support = await register('kb.owner.agent@company.com', 'KB Owner');
    setRole(support.user.email, Role.SUPPORT_AGENT);
    const supportLogin = await login('kb.owner.agent@company.com');
    const user = await register('kb.regular@company.com', 'KB Regular User');

    const created = await request(app.getHttpServer())
      .post('/api/knowledge-base/articles')
      .set('Authorization', `Bearer ${supportLogin.accessToken}`)
      .send({
        title: 'Operations schedule change process',
        content: 'Submit changes 24h before handoff and notify stakeholders.',
        category: 'OPERATIONS',
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/knowledge-base/articles/${created.body.id as string}`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ title: 'Malicious update attempt' })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/knowledge-base/articles/${created.body.id as string}/publish`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/knowledge-base/articles/${created.body.id as string}/archive`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(403);
  });

  it('search returns relevant published chunks and excludes drafts for USER', async () => {
    const support = await register(
      'kb.search.agent@company.com',
      'KB Search Agent',
    );
    setRole(support.user.email, Role.SUPPORT_AGENT);
    const supportLogin = await login('kb.search.agent@company.com');
    const user = await register('kb.search.user@company.com', 'KB Search User');

    const published = await request(app.getHttpServer())
      .post('/api/knowledge-base/articles')
      .set('Authorization', `Bearer ${supportLogin.accessToken}`)
      .send({
        title: 'IT access issue troubleshooting',
        content:
          'When dashboard login fails, check access lock, reset credentials, and validate VPN connection.',
        category: 'IT',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `/api/knowledge-base/articles/${published.body.id as string}/publish`,
      )
      .set('Authorization', `Bearer ${supportLogin.accessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/knowledge-base/articles')
      .set('Authorization', `Bearer ${supportLogin.accessToken}`)
      .send({
        title: 'Draft IT fallback notes',
        content: 'Draft-only internal note about test credentials.',
        category: 'IT',
      })
      .expect(201);

    const userSearch = await request(app.getHttpServer())
      .get('/api/knowledge-base/search')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .query({ query: 'dashboard login blocked', category: 'IT', limit: 2 })
      .expect(200);

    expect(Array.isArray(userSearch.body)).toBe(true);
    expect(userSearch.body.length).toBeGreaterThan(0);
    expect(
      userSearch.body.every(
        (row: { status: KnowledgeArticleStatus; category: TicketCategory }) =>
          row.status === 'PUBLISHED' && row.category === 'IT',
      ),
    ).toBe(true);

    const supportSearch = await request(app.getHttpServer())
      .get('/api/knowledge-base/search')
      .set('Authorization', `Bearer ${supportLogin.accessToken}`)
      .query({
        query: 'test credentials',
        category: 'IT',
        includeNonPublished: true,
        limit: 5,
      })
      .expect(200);

    expect(
      supportSearch.body.some(
        (row: { articleTitle: string }) =>
          row.articleTitle === 'Draft IT fallback notes',
      ),
    ).toBe(true);
  });

  it('list articles applies pagination and role visibility', async () => {
    const support = await register(
      'kb.list.agent@company.com',
      'KB List Agent',
    );
    setRole(support.user.email, Role.SUPPORT_AGENT);
    const supportLogin = await login('kb.list.agent@company.com');
    const user = await register('kb.list.user@company.com', 'KB List User');

    const draft = await request(app.getHttpServer())
      .post('/api/knowledge-base/articles')
      .set('Authorization', `Bearer ${supportLogin.accessToken}`)
      .send({
        title: 'Customer escalation draft',
        content: 'Draft handling guide.',
        category: 'CUSTOMER_SUPPORT',
      })
      .expect(201);

    const published = await request(app.getHttpServer())
      .post('/api/knowledge-base/articles')
      .set('Authorization', `Bearer ${supportLogin.accessToken}`)
      .send({
        title: 'Published customer escalation policy',
        content: 'Published handling guide.',
        category: 'CUSTOMER_SUPPORT',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(
        `/api/knowledge-base/articles/${published.body.id as string}/publish`,
      )
      .set('Authorization', `Bearer ${supportLogin.accessToken}`)
      .expect(201);

    const userList = await request(app.getHttpServer())
      .get('/api/knowledge-base/articles')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .query({ limit: 1, page: 1, category: 'CUSTOMER_SUPPORT' })
      .expect(200);
    const userListBody = userList.body as KnowledgeListResponse;
    expect(userListBody.meta.limit).toBe(1);
    expect(
      userListBody.data.every(
        (row) => row.status === KnowledgeArticleStatus.PUBLISHED,
      ),
    ).toBe(true);

    const supportList = await request(app.getHttpServer())
      .get('/api/knowledge-base/articles')
      .set('Authorization', `Bearer ${supportLogin.accessToken}`)
      .query({
        includeNonPublished: true,
        category: 'CUSTOMER_SUPPORT',
        search: 'escalation',
      })
      .expect(200);
    const supportRows = (supportList.body as KnowledgeListResponse).data;
    expect(
      supportRows.some(
        (row) => row.id === draft.body.id && row.status === 'DRAFT',
      ),
    ).toBe(true);
  });

  it('ticket AI analysis retrieves KB context and writes context audit event', async () => {
    const support = await register('kb.ai.agent@company.com', 'KB AI Agent');
    setRole(support.user.email, Role.SUPPORT_AGENT);
    const supportLogin = await login('kb.ai.agent@company.com');
    const user = await register('kb.ai.user@company.com', 'KB AI User');

    const article = await request(app.getHttpServer())
      .post('/api/knowledge-base/articles')
      .set('Authorization', `Bearer ${supportLogin.accessToken}`)
      .send({
        title: 'IT dashboard access troubleshooting',
        content:
          'If users are blocked from dashboard login, verify account state, reset SSO session, and collect network diagnostics.',
        category: 'IT',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/knowledge-base/articles/${article.body.id as string}/publish`)
      .set('Authorization', `Bearer ${supportLogin.accessToken}`)
      .expect(201);

    const ticket = await createTicket(user.accessToken, {
      title: 'Cannot access dashboard',
      description:
        'Login is blocked and I need urgent access to production tools.',
      category: 'IT',
      priority: 'MEDIUM',
    });

    const analysis = await request(app.getHttpServer())
      .post(`/api/tickets/${ticket.body.id as string}/ai/analyze`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(201);

    expect(analysis.body.aiSummary).toBeTruthy();
    expect(analysis.body.aiConfidence).toBeGreaterThan(0);
    expect(analysis.body.recommendedAction).toContain('knowledge base context');
    expect(Array.isArray(analysis.body.contextSources)).toBe(true);
    expect(analysis.body.contextSources.length).toBeGreaterThan(0);

    const suggestion = await request(app.getHttpServer())
      .get(`/api/tickets/${ticket.body.id as string}/ai/suggestion`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);
    expect(Array.isArray(suggestion.body.contextSources)).toBe(true);

    const contextLogs = mockPrisma.auditLogs.filter(
      (entry) => entry.action === 'ticket_ai_context_retrieved',
    );
    expect(contextLogs.length).toBeGreaterThan(0);
  });

  it('QUEUE_MODE=sync preserves direct AI analysis response', async () => {
    const modeSpy = jest
      .spyOn(jobsService, 'isAsyncMode')
      .mockReturnValue(false);
    const user = await register('sync.ai.user@company.com', 'Sync AI User');
    const created = await createTicket(user.accessToken, {
      title: 'sync mode analysis',
      description: 'Need direct synchronous analysis result.',
      category: 'IT',
      priority: 'LOW',
    });

    const response = await request(app.getHttpServer())
      .post(`/api/tickets/${created.body.id as string}/ai/analyze`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(201);

    expect(response.body.category).toBeTruthy();
    expect(response.body.provider).toBe('mock');
    modeSpy.mockRestore();
  });

  it('QUEUE_MODE=async returns queued response and creates BackgroundJob', async () => {
    const modeSpy = jest
      .spyOn(jobsService, 'isAsyncMode')
      .mockReturnValue(true);
    const publishSpy = jest
      .spyOn(realtimeService, 'publish')
      .mockResolvedValue(undefined);

    const user = await register('async.ai.user@company.com', 'Async AI User');
    const created = await createTicket(user.accessToken, {
      title: 'async mode analysis',
      description: 'Should queue analysis job.',
      category: 'IT',
      priority: 'MEDIUM',
    });
    const callsBeforeAnalyze = publishSpy.mock.calls.length;

    const response = await request(app.getHttpServer())
      .post(`/api/tickets/${created.body.id as string}/ai/analyze`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(201);

    expect(response.body.status).toBe('QUEUED');
    expect(response.body.jobId).toBeTruthy();

    const queuedJob = mockPrisma.backgroundJobs.find(
      (item) => item.id === (response.body.jobId as string),
    );
    expect(queuedJob?.type).toBe(BackgroundJobType.TICKET_AI_ANALYSIS);
    expect(publishSpy.mock.calls.length).toBeGreaterThan(callsBeforeAnalyze);
    publishSpy.mockRestore();
    modeSpy.mockRestore();
  });

  it('user cannot enqueue AI analysis for another user ticket in async mode', async () => {
    const modeSpy = jest
      .spyOn(jobsService, 'isAsyncMode')
      .mockReturnValue(true);
    const owner = await register('async.owner@company.com', 'Async Owner');
    const outsider = await register(
      'async.outsider@company.com',
      'Async Outsider',
    );
    const created = await createTicket(owner.accessToken, {
      title: 'private async ticket',
      description: 'Outsider should not queue this ticket.',
      category: 'OTHER',
      priority: 'LOW',
    });

    await request(app.getHttpServer())
      .post(`/api/tickets/${created.body.id as string}/ai/analyze`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .expect(404);

    modeSpy.mockRestore();
  });

  it('support agent can enqueue AI analysis for any ticket in async mode', async () => {
    const modeSpy = jest
      .spyOn(jobsService, 'isAsyncMode')
      .mockReturnValue(true);
    const owner = await register('async.owner2@company.com', 'Async Owner 2');
    const support = await register(
      'async.support@company.com',
      'Async Support Agent',
    );
    setRole(support.user.email, Role.SUPPORT_AGENT);
    const supportLogin = await login('async.support@company.com');

    const created = await createTicket(owner.accessToken, {
      title: 'support enqueue ticket',
      description: 'Support should queue this ticket.',
      category: 'IT',
      priority: 'MEDIUM',
    });

    const response = await request(app.getHttpServer())
      .post(`/api/tickets/${created.body.id as string}/ai/analyze`)
      .set('Authorization', `Bearer ${supportLogin.accessToken}`)
      .expect(201);

    expect(response.body.status).toBe('QUEUED');
    modeSpy.mockRestore();
  });

  it('job status endpoint returns job for authorized user', async () => {
    const modeSpy = jest
      .spyOn(jobsService, 'isAsyncMode')
      .mockReturnValue(true);
    const user = await register(
      'job.status.user@company.com',
      'Job Status User',
    );
    const created = await createTicket(user.accessToken, {
      title: 'job status ticket',
      description: 'Job status visibility for owner.',
      category: 'OTHER',
      priority: 'LOW',
    });

    const queued = await request(app.getHttpServer())
      .post(`/api/tickets/${created.body.id as string}/ai/analyze`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(201);

    const jobId = queued.body.jobId as string;
    const response = await request(app.getHttpServer())
      .get(`/api/jobs/${jobId}`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);

    expect(response.body.id).toBe(jobId);
    expect(response.body.entityId).toBe(created.body.id as string);
    modeSpy.mockRestore();
  });

  it('unauthorized user cannot read another user job', async () => {
    const modeSpy = jest
      .spyOn(jobsService, 'isAsyncMode')
      .mockReturnValue(true);
    const owner = await register('job.owner@company.com', 'Job Owner');
    const outsider = await register('job.outsider@company.com', 'Job Outsider');

    const created = await createTicket(owner.accessToken, {
      title: 'private job ticket',
      description: 'Outsider cannot access related job.',
      category: 'OTHER',
      priority: 'LOW',
    });

    const queued = await request(app.getHttpServer())
      .post(`/api/tickets/${created.body.id as string}/ai/analyze`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/jobs/${queued.body.jobId as string}`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .expect(404);

    modeSpy.mockRestore();
  });

  it('worker-like processing updates queued AI job and ticket', async () => {
    const modeSpy = jest
      .spyOn(jobsService, 'isAsyncMode')
      .mockReturnValue(true);
    const publishSpy = jest
      .spyOn(realtimeService, 'publish')
      .mockResolvedValue(undefined);

    const user = await register('worker.ai.user@company.com', 'Worker AI User');
    const created = await createTicket(user.accessToken, {
      title: 'worker processing ticket',
      description: 'This should be processed by worker-like flow.',
      category: 'IT',
      priority: 'LOW',
    });

    const queued = await request(app.getHttpServer())
      .post(`/api/tickets/${created.body.id as string}/ai/analyze`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(201);

    const jobId = queued.body.jobId as string;
    const callsBeforeWorkerFlow = publishSpy.mock.calls.length;
    await jobsService.markProcessing({ jobId, attempts: 1 });
    await ticketsService.analyzeTicketForJob({
      ticketId: created.body.id as string,
      actorId: user.user.id,
      backgroundJobId: jobId,
      queueName: 'ticket-ai',
      jobName: 'analyze-ticket',
    });
    await jobsService.markCompleted({
      jobId,
      attempts: 1,
      metadata: { durationMs: 1 },
    });

    const updatedTicket = mockPrisma.tickets.find(
      (item) => item.id === (created.body.id as string),
    );
    expect(updatedTicket?.aiSummary).toBeTruthy();
    expect(updatedTicket?.aiConfidence).not.toBeNull();

    const updatedJob = mockPrisma.backgroundJobs.find(
      (item) => item.id === jobId,
    );
    expect(updatedJob?.status).toBe(BackgroundJobStatus.COMPLETED);
    expect(publishSpy.mock.calls.length).toBeGreaterThan(callsBeforeWorkerFlow);
    publishSpy.mockRestore();
    modeSpy.mockRestore();
  });

  it('failed AI worker path marks background job as FAILED', async () => {
    const modeSpy = jest
      .spyOn(jobsService, 'isAsyncMode')
      .mockReturnValue(true);
    const publishSpy = jest
      .spyOn(realtimeService, 'publish')
      .mockResolvedValue(undefined);

    const user = await register(
      'worker.fail.user@company.com',
      'Worker Fail User',
    );
    const created = await createTicket(user.accessToken, {
      title: 'worker failure ticket',
      description: 'Worker should mark this job as failed.',
      category: 'OTHER',
      priority: 'LOW',
    });

    const queued = await request(app.getHttpServer())
      .post(`/api/tickets/${created.body.id as string}/ai/analyze`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(201);

    const jobId = queued.body.jobId as string;
    const analyzeSpy = jest
      .spyOn(aiService, 'analyzeTicket')
      .mockRejectedValueOnce(new Error('worker provider down'));
    const callsBeforeFailureFlow = publishSpy.mock.calls.length;

    await jobsService.markProcessing({ jobId, attempts: 1 });
    await expect(
      ticketsService.analyzeTicketForJob({
        ticketId: created.body.id as string,
        actorId: user.user.id,
        backgroundJobId: jobId,
        queueName: 'ticket-ai',
        jobName: 'analyze-ticket',
      }),
    ).rejects.toThrow();
    await jobsService.markFailed({
      jobId,
      attempts: 1,
      reason: 'worker provider down',
    });
    analyzeSpy.mockRestore();

    const failedJob = mockPrisma.backgroundJobs.find(
      (item) => item.id === jobId,
    );
    expect(failedJob?.status).toBe(BackgroundJobStatus.FAILED);
    expect(publishSpy.mock.calls.length).toBeGreaterThan(
      callsBeforeFailureFlow,
    );
    publishSpy.mockRestore();
    modeSpy.mockRestore();
  });

  it('support agent can enqueue article rechunk in async mode', async () => {
    const modeSpy = jest
      .spyOn(jobsService, 'isAsyncMode')
      .mockReturnValue(true);
    const support = await register(
      'rechunk.agent@company.com',
      'Rechunk Agent',
    );
    setRole(support.user.email, Role.SUPPORT_AGENT);
    const supportLogin = await login('rechunk.agent@company.com');

    const article = await request(app.getHttpServer())
      .post('/api/knowledge-base/articles')
      .set('Authorization', `Bearer ${supportLogin.accessToken}`)
      .send({
        title: 'Rechunk async article',
        content: 'This article will be rechunked asynchronously.',
        category: 'IT',
      })
      .expect(201);

    const queued = await request(app.getHttpServer())
      .post(`/api/knowledge-base/articles/${article.body.id as string}/rechunk`)
      .set('Authorization', `Bearer ${supportLogin.accessToken}`)
      .expect(201);

    expect(queued.body.status).toBe('QUEUED');
    modeSpy.mockRestore();
  });

  it('user cannot enqueue article rechunk in async mode', async () => {
    const modeSpy = jest
      .spyOn(jobsService, 'isAsyncMode')
      .mockReturnValue(true);
    const support = await register(
      'rechunk.owner@company.com',
      'Rechunk Owner',
    );
    setRole(support.user.email, Role.SUPPORT_AGENT);
    const supportLogin = await login('rechunk.owner@company.com');
    const user = await register('rechunk.user@company.com', 'Rechunk User');

    const article = await request(app.getHttpServer())
      .post('/api/knowledge-base/articles')
      .set('Authorization', `Bearer ${supportLogin.accessToken}`)
      .send({
        title: 'Rechunk owner article',
        content: 'Only support/admin can rechunk this.',
        category: 'IT',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/knowledge-base/articles/${article.body.id as string}/rechunk`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(403);

    modeSpy.mockRestore();
  });

  it('worker-like rechunk flow completes and preserves chunks', async () => {
    const modeSpy = jest
      .spyOn(jobsService, 'isAsyncMode')
      .mockReturnValue(true);
    const support = await register(
      'worker.rechunk.agent@company.com',
      'Worker Rechunk Agent',
    );
    setRole(support.user.email, Role.SUPPORT_AGENT);
    const supportLogin = await login('worker.rechunk.agent@company.com');

    const article = await request(app.getHttpServer())
      .post('/api/knowledge-base/articles')
      .set('Authorization', `Bearer ${supportLogin.accessToken}`)
      .send({
        title: 'Worker rechunk flow article',
        content:
          'Line one for chunking.\nLine two for chunking.\nLine three for chunking.',
        category: 'OPERATIONS',
      })
      .expect(201);

    const queued = await request(app.getHttpServer())
      .post(`/api/knowledge-base/articles/${article.body.id as string}/rechunk`)
      .set('Authorization', `Bearer ${supportLogin.accessToken}`)
      .expect(201);

    const jobId = queued.body.jobId as string;
    await jobsService.markProcessing({ jobId, attempts: 1 });
    await knowledgeBaseService.rechunkArticleForJob({
      articleId: article.body.id as string,
      actorId: support.user.id,
      backgroundJobId: jobId,
      queueName: 'knowledge-base',
      jobName: 'rechunk-article',
    });
    await jobsService.markCompleted({
      jobId,
      attempts: 1,
      metadata: { durationMs: 1 },
    });

    const updatedArticle = mockPrisma.knowledgeArticles.find(
      (item) => item.id === (article.body.id as string),
    );
    const chunks = mockPrisma.knowledgeChunks.filter(
      (item) => item.articleId === (article.body.id as string),
    );
    expect(updatedArticle).toBeTruthy();
    expect(chunks.length).toBeGreaterThan(0);
    expect(
      mockPrisma.backgroundJobs.find((item) => item.id === jobId)?.status,
    ).toBe(BackgroundJobStatus.COMPLETED);
    modeSpy.mockRestore();
  });

  it('failed rechunk worker path marks job as FAILED', async () => {
    const modeSpy = jest
      .spyOn(jobsService, 'isAsyncMode')
      .mockReturnValue(true);
    const support = await register(
      'worker.rechunk.fail@company.com',
      'Worker Rechunk Fail',
    );
    setRole(support.user.email, Role.SUPPORT_AGENT);

    const queued = await jobsService.enqueueKnowledgeRechunk({
      actorId: support.user.id,
      articleId: randomUUID(),
    });

    await jobsService.markProcessing({ jobId: queued.jobId, attempts: 1 });
    await expect(
      knowledgeBaseService.rechunkArticleForJob({
        articleId: queued.entityId,
        actorId: support.user.id,
        backgroundJobId: queued.jobId,
        queueName: 'knowledge-base',
        jobName: 'rechunk-article',
      }),
    ).rejects.toThrow();
    await jobsService.markFailed({
      jobId: queued.jobId,
      attempts: 1,
      reason: 'Knowledge article not found',
    });

    expect(
      mockPrisma.backgroundJobs.find((item) => item.id === queued.jobId)
        ?.status,
    ).toBe(BackgroundJobStatus.FAILED);
    modeSpy.mockRestore();
  });

  async function register(
    email: string,
    fullName: string,
  ): Promise<AuthPayload> {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email,
        password: 'StrongPass123!',
        fullName,
      })
      .expect(201);

    return response.body as AuthPayload;
  }

  async function login(email: string): Promise<AuthPayload> {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email,
        password: 'StrongPass123!',
      })
      .expect(200);

    return response.body as AuthPayload;
  }

  async function createTicket(
    accessToken: string,
    data: {
      title: string;
      description: string;
      category:
        | 'HR'
        | 'IT'
        | 'FINANCE'
        | 'OPERATIONS'
        | 'CUSTOMER_SUPPORT'
        | 'OTHER';
      priority: 'LOW' | 'MEDIUM' | 'HIGH';
    },
  ) {
    return request(app.getHttpServer())
      .post('/api/tickets')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(data)
      .expect(201);
  }

  function setRole(email: string, role: Role): void {
    const user = mockPrisma.users.find((item) => item.email === email);
    if (!user) {
      throw new Error(`User ${email} not found`);
    }
    user.role = role;
  }
});

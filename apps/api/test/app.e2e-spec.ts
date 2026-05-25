import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AuditLog,
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
import { PrismaService } from '../src/prisma/prisma.service';

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

type UserSummary = Pick<User, 'id' | 'email' | 'fullName' | 'role'>;
type TicketWithUsers = Ticket & {
  createdBy: UserSummary;
  assignedTo: UserSummary | null;
};

class MockPrismaService {
  public readonly users: User[] = [];
  public readonly tickets: Ticket[] = [];
  public readonly auditLogs: AuditLog[] = [];

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
        updatedAt: new Date(),
      };

      this.tickets[index] = updated;
      return args.include ? this.enrichTicket(updated) : updated;
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
  });

  afterAll(async () => {
    await app.close();
  });

  it('user creates ticket', async () => {
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

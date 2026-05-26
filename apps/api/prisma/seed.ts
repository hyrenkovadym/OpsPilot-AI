import {
  KnowledgeArticleStatus,
  PrismaClient,
  Role,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

function chunkText(content: string, maxChunkChars = 800) {
  const normalized = content.replace(/\r\n/g, '\n').trim();
  if (normalized.length === 0) {
    return [];
  }

  const paragraphs = normalized
    .split('\n')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  const chunks: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChunkChars) {
      if (current.length > 0) {
        chunks.push(current.trim());
        current = '';
      }

      for (let index = 0; index < paragraph.length; index += maxChunkChars) {
        const piece = paragraph.slice(index, index + maxChunkChars).trim();
        if (piece.length > 0) {
          chunks.push(piece);
        }
      }
      continue;
    }

    const candidate = current.length > 0 ? `${current}\n${paragraph}` : paragraph;
    if (candidate.length > maxChunkChars) {
      chunks.push(current.trim());
      current = paragraph;
    } else {
      current = candidate;
    }
  }

  if (current.length > 0) {
    chunks.push(current.trim());
  }

  return chunks;
}

async function upsertKnowledgeArticle(input: {
  title: string;
  content: string;
  category: TicketCategory;
  createdById: string;
  updatedById: string;
}) {
  const existing = await prisma.knowledgeBaseArticle.findFirst({
    where: { title: input.title },
    select: { id: true },
  });

  const article = existing
    ? await prisma.knowledgeBaseArticle.update({
        where: { id: existing.id },
        data: {
          content: input.content,
          category: input.category,
          status: KnowledgeArticleStatus.PUBLISHED,
          updatedById: input.updatedById,
        },
      })
    : await prisma.knowledgeBaseArticle.create({
        data: {
          title: input.title,
          content: input.content,
          category: input.category,
          status: KnowledgeArticleStatus.PUBLISHED,
          createdById: input.createdById,
          updatedById: input.updatedById,
        },
      });

  await prisma.knowledgeBaseChunk.deleteMany({
    where: { articleId: article.id },
  });

  const chunks = chunkText(input.content);
  if (chunks.length > 0) {
    await prisma.knowledgeBaseChunk.createMany({
      data: chunks.map((chunk, index) => ({
        articleId: article.id,
        chunkIndex: index,
        content: chunk,
        tokensEstimate: Math.max(1, Math.round(chunk.length / 4)),
      })),
    });
  }
}

async function upsertDemoUser(
  email: string,
  fullName: string,
  role: Role,
  passwordHash: string,
) {
  return prisma.user.upsert({
    where: { email },
    update: { fullName, role, passwordHash },
    create: { email, fullName, role, passwordHash },
  });
}

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash('Password123!', 10);

  const admin = await upsertDemoUser(
    'admin@example.com',
    'OpsPilot Admin',
    Role.ADMIN,
    passwordHash,
  );
  const agent = await upsertDemoUser(
    'agent@example.com',
    'OpsPilot Support Agent',
    Role.SUPPORT_AGENT,
    passwordHash,
  );
  const user = await upsertDemoUser(
    'user@example.com',
    'OpsPilot User',
    Role.USER,
    passwordHash,
  );

  const existingTickets = await prisma.ticket.count({
    where: {
      createdById: user.id,
    },
  });

  if (existingTickets === 0) {
    await prisma.ticket.createMany({
      data: [
        {
          title: 'VPN onboarding access request',
          description:
            'Please provide VPN credentials and setup instructions for the new employee.',
          category: TicketCategory.IT,
          status: TicketStatus.OPEN,
          priority: TicketPriority.HIGH,
          createdById: user.id,
          assignedToId: agent.id,
          aiSummary:
            'Ticket requests urgent VPN access for employee onboarding setup.',
          aiConfidence: 0.88,
          aiRecommendedAction:
            'Prioritize with IT access team and confirm VPN credentials delivery.',
        },
        {
          title: 'Payroll overtime discrepancy',
          description:
            'Overtime hours from last week are missing from this month payroll report.',
          category: TicketCategory.FINANCE,
          status: TicketStatus.IN_PROGRESS,
          priority: TicketPriority.MEDIUM,
          createdById: user.id,
          assignedToId: agent.id,
          aiSummary:
            'Ticket reports payroll overtime discrepancy requiring finance review.',
          aiConfidence: 0.82,
          aiRecommendedAction:
            'Validate overtime records and coordinate correction with payroll operations.',
        },
        {
          title: 'Office badge replacement',
          description: 'Office access badge stopped working at the main entrance.',
          category: TicketCategory.OPERATIONS,
          status: TicketStatus.RESOLVED,
          priority: TicketPriority.LOW,
          createdById: user.id,
          assignedToId: agent.id,
          aiSummary:
            'Ticket covers office badge failure that impacted entrance access.',
          aiConfidence: 0.76,
          aiRecommendedAction:
            'Issue replacement badge and verify access control synchronization.',
        },
      ],
    });
  }

  await upsertKnowledgeArticle({
    title: 'HR vacation policy',
    content:
      'Employees should submit vacation requests at least 10 business days in advance.\nManagers approve requests in the HR portal based on team capacity.\nUrgent exceptions require direct manager and HR operations approval.',
    category: TicketCategory.HR,
    createdById: admin.id,
    updatedById: agent.id,
  });

  await upsertKnowledgeArticle({
    title: 'IT access issue troubleshooting',
    content:
      'If a user cannot access the internal dashboard, verify account status and lock state first.\nReset SSO session and ask the user to clear browser cache.\nIf still blocked, collect VPN/network logs and escalate to the IT on-call engineer.',
    category: TicketCategory.IT,
    createdById: admin.id,
    updatedById: agent.id,
  });

  await upsertKnowledgeArticle({
    title: 'Finance expense reimbursement',
    content:
      'Employees must submit expense reimbursement with receipts in the finance portal within 10 business days.\nFinance reviews category eligibility and approval chain before payout.\nMissing receipts should be flagged and returned for correction.',
    category: TicketCategory.FINANCE,
    createdById: admin.id,
    updatedById: agent.id,
  });

  await upsertKnowledgeArticle({
    title: 'Operations schedule change process',
    content:
      'Operational schedule changes must be submitted 24 hours before the shift handoff.\nThe requester documents impact, affected teams, and fallback plan.\nOperations lead approves and publishes the updated schedule.',
    category: TicketCategory.OPERATIONS,
    createdById: admin.id,
    updatedById: agent.id,
  });

  await upsertKnowledgeArticle({
    title: 'Customer support escalation policy',
    content:
      'Customer issues with production impact must be escalated immediately to support lead.\nCritical tickets require SLA acknowledgment within 15 minutes.\nAll escalations should include customer impact summary and current workaround status.',
    category: TicketCategory.CUSTOMER_SUPPORT,
    createdById: admin.id,
    updatedById: agent.id,
  });

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: 'seed_completed',
      entityType: 'system',
      entityId: 'seed',
      metadata: {
        users: ['admin@example.com', 'agent@example.com', 'user@example.com'],
      },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

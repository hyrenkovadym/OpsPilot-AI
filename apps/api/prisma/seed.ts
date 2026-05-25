import {
  PrismaClient,
  Role,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

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

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: 'seed_completed',
      entityType: 'system',
      entityId: 'seed',
      metadata: {
        users: ['admin@example.com', 'agent@example.com', 'user@example.com'],
        defaultPassword: 'Password123!',
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

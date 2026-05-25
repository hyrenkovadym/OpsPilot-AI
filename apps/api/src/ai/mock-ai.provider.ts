import { Injectable } from '@nestjs/common';
import { TicketCategory, TicketPriority } from '@prisma/client';
import type {
  AiProvider,
  AiTicketAnalysis,
  AiTicketInput,
} from './ai-provider.interface';
import { validateAiTicketAnalysis } from './schemas/ai-ticket-analysis.schema';

@Injectable()
export class MockAiProvider implements AiProvider {
  readonly name = 'mock' as const;

  analyzeTicket(ticket: AiTicketInput): Promise<AiTicketAnalysis> {
    const source = `${ticket.title} ${ticket.description}`.toLowerCase();
    const category = this.resolveCategory(source);
    const priority = this.resolvePriority(source);
    const aiSummary = this.createSummary(ticket.title, ticket.description);
    const recommendedAction = this.resolveRecommendedAction(category, priority);
    const aiConfidence = this.resolveConfidence(category, priority);

    return Promise.resolve(
      validateAiTicketAnalysis({
        category,
        priority,
        aiSummary,
        aiConfidence,
        recommendedAction,
      }),
    );
  }

  private resolveCategory(content: string): TicketCategory {
    if (
      this.hasAny(content, ['hr', 'onboarding', 'benefit', 'leave', 'policy'])
    ) {
      return TicketCategory.HR;
    }

    if (
      this.hasAny(content, [
        'login',
        'access',
        'password',
        'device',
        'network',
        'vpn',
        'laptop',
        'server',
        'system',
      ])
    ) {
      return TicketCategory.IT;
    }

    if (
      this.hasAny(content, [
        'invoice',
        'payment',
        'salary',
        'payroll',
        'expense',
        'refund',
        'finance',
      ])
    ) {
      return TicketCategory.FINANCE;
    }

    if (
      this.hasAny(content, [
        'customer',
        'client',
        'support',
        'sla',
        'complaint',
        'case',
      ])
    ) {
      return TicketCategory.CUSTOMER_SUPPORT;
    }

    if (
      this.hasAny(content, [
        'process',
        'operations',
        'schedule',
        'logistics',
        'workflow',
        'handoff',
      ])
    ) {
      return TicketCategory.OPERATIONS;
    }

    return TicketCategory.OTHER;
  }

  private resolvePriority(content: string): TicketPriority {
    if (this.hasAny(content, ['urgent', 'blocked', 'production', 'critical'])) {
      return TicketPriority.HIGH;
    }

    if (this.hasAny(content, ['soon', 'issue', 'problem'])) {
      return TicketPriority.MEDIUM;
    }

    return TicketPriority.LOW;
  }

  private resolveRecommendedAction(
    category: TicketCategory,
    priority: TicketPriority,
  ): string {
    const urgencyPrefix =
      priority === TicketPriority.HIGH
        ? 'Escalate to on-call support and start triage immediately.'
        : 'Create a standard support follow-up and track progress in the queue.';

    if (category === TicketCategory.IT) {
      return `${urgencyPrefix} Verify account/device/network diagnostics and update the ticket with findings.`;
    }

    if (category === TicketCategory.FINANCE) {
      return `${urgencyPrefix} Validate transaction records and coordinate with finance operations for resolution details.`;
    }

    if (category === TicketCategory.HR) {
      return `${urgencyPrefix} Review HR policy context and route to the HR operations owner.`;
    }

    if (category === TicketCategory.CUSTOMER_SUPPORT) {
      return `${urgencyPrefix} Assign a customer support specialist and confirm customer communication timeline.`;
    }

    if (category === TicketCategory.OPERATIONS) {
      return `${urgencyPrefix} Review process ownership and confirm next operational checkpoint.`;
    }

    return `${urgencyPrefix} Gather additional context before reclassifying the ticket.`;
  }

  private resolveConfidence(
    category: TicketCategory,
    priority: TicketPriority,
  ): number {
    const categoryScore = category === TicketCategory.OTHER ? 0.55 : 0.78;
    const priorityBonus = priority === TicketPriority.HIGH ? 0.12 : 0.05;
    return Math.min(0.97, Number((categoryScore + priorityBonus).toFixed(2)));
  }

  private createSummary(title: string, description: string): string {
    const normalized = `${title.trim()}: ${description.trim()}`.replace(
      /\s+/g,
      ' ',
    );
    if (normalized.length <= 180) {
      return normalized;
    }

    return `${normalized.slice(0, 177)}...`;
  }

  private hasAny(content: string, keywords: string[]): boolean {
    return keywords.some((keyword) => content.includes(keyword));
  }
}

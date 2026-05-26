import { TicketCategory, TicketPriority } from '@prisma/client';
import type { AiTicketAnalysis } from '../ai-provider.interface';

const allowedCategories = Object.values(TicketCategory);
const allowedPriorities = Object.values(TicketPriority);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid AI output: ${field} must be a non-empty string`);
  }

  return value.trim();
}

export function validateAiTicketAnalysis(input: unknown): AiTicketAnalysis {
  if (!isRecord(input)) {
    throw new Error('Invalid AI output: expected object payload');
  }

  const category = input.category;
  const priority = input.priority;
  const aiSummary = normalizeText(input.aiSummary, 'aiSummary');
  const recommendedAction = normalizeText(
    input.recommendedAction,
    'recommendedAction',
  );
  const aiConfidence = input.aiConfidence;

  if (
    typeof category !== 'string' ||
    !allowedCategories.includes(category as TicketCategory)
  ) {
    throw new Error(
      `Invalid AI output: category must be one of ${allowedCategories.join(', ')}`,
    );
  }

  if (
    typeof priority !== 'string' ||
    !allowedPriorities.includes(priority as TicketPriority)
  ) {
    throw new Error(
      `Invalid AI output: priority must be one of ${allowedPriorities.join(', ')}`,
    );
  }

  if (
    typeof aiConfidence !== 'number' ||
    Number.isNaN(aiConfidence) ||
    aiConfidence < 0 ||
    aiConfidence > 1
  ) {
    throw new Error(
      'Invalid AI output: aiConfidence must be a number between 0 and 1',
    );
  }

  return {
    category: category as TicketCategory,
    priority: priority as TicketPriority,
    aiSummary,
    aiConfidence,
    recommendedAction,
  };
}

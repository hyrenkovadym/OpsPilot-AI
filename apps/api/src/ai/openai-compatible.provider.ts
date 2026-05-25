import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AiProvider,
  AiTicketAnalysis,
  AiTicketInput,
} from './ai-provider.interface';
import { validateAiTicketAnalysis } from './schemas/ai-ticket-analysis.schema';

interface OpenAIChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

@Injectable()
export class OpenAiCompatibleProvider implements AiProvider {
  readonly name = 'openai' as const;
  private readonly apiKey: string | null;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(private readonly configService: ConfigService) {
    const configuredKey =
      this.configService.get<string>('ai.openai.apiKey') ??
      this.configService.get<string>('OPENAI_API_KEY') ??
      '';
    this.apiKey = configuredKey.trim().length > 0 ? configuredKey : null;
    this.baseUrl =
      this.configService.get<string>('ai.openai.baseUrl') ??
      'https://api.openai.com/v1';
    this.model =
      this.configService.get<string>('ai.openai.model') ?? 'gpt-4o-mini';
    const timeoutSeconds =
      this.configService.get<number>('ai.openai.timeoutSeconds') ?? 20;
    this.timeoutMs = timeoutSeconds * 1000;
    this.maxRetries =
      this.configService.get<number>('ai.openai.maxRetries') ?? 1;
  }

  assertConfiguration(): void {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is required when AI_PROVIDER=openai');
    }
  }

  async analyzeTicket(ticket: AiTicketInput): Promise<AiTicketAnalysis> {
    this.assertConfiguration();

    const payload = {
      model: this.model,
      response_format: {
        type: 'json_object',
      },
      messages: [
        {
          role: 'system',
          content:
            'You analyze internal support tickets. Respond with strict JSON only.',
        },
        {
          role: 'user',
          content: this.buildPrompt(ticket),
        },
      ],
      temperature: 0.1,
    };

    const response = await this.executeWithRetry(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const result = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!result.ok) {
          const statusText = result.statusText || 'Unknown error';
          throw new Error(
            `OpenAI-compatible request failed with status ${result.status}: ${statusText}`,
          );
        }

        const json = (await result.json()) as OpenAIChatCompletionResponse;
        const content = json.choices?.[0]?.message?.content;

        if (typeof content !== 'string' || content.trim().length === 0) {
          throw new Error(
            'OpenAI-compatible response did not include JSON content',
          );
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(content);
        } catch {
          throw new Error(
            'OpenAI-compatible response returned invalid JSON payload',
          );
        }

        return validateAiTicketAnalysis(parsed);
      } finally {
        clearTimeout(timeout);
      }
    });

    return response;
  }

  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= this.maxRetries) {
      try {
        return await operation();
      } catch (error) {
        const normalized =
          error instanceof Error ? error : new Error('Unknown provider error');
        const isAbort = normalized.name === 'AbortError';
        lastError = isAbort
          ? new Error('OpenAI-compatible request timed out')
          : normalized;
        attempt += 1;

        if (attempt > this.maxRetries) {
          break;
        }
      }
    }

    throw lastError ?? new Error('OpenAI-compatible request failed');
  }

  private buildPrompt(ticket: AiTicketInput): string {
    return [
      'Analyze this internal support ticket and return strict JSON with keys:',
      'category, priority, aiSummary, aiConfidence, recommendedAction.',
      'Allowed category: HR, IT, FINANCE, OPERATIONS, CUSTOMER_SUPPORT, OTHER.',
      'Allowed priority: LOW, MEDIUM, HIGH.',
      'aiConfidence must be a number between 0 and 1.',
      '',
      `Title: ${ticket.title}`,
      `Description: ${ticket.description}`,
      `Current category: ${ticket.category}`,
      `Current priority: ${ticket.priority}`,
      `Current status: ${ticket.status}`,
    ].join('\n');
  }
}

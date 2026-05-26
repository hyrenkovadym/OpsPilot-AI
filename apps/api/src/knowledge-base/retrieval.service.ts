import { Injectable } from '@nestjs/common';
import {
  KnowledgeArticleStatus,
  Prisma,
  Role,
  TicketCategory,
} from '@prisma/client';
import type { AuthenticatedUser } from '../common/types/jwt-payload.type';
import { PrismaService } from '../prisma/prisma.service';
import type { SearchKnowledgeQueryDto } from './dto/search-knowledge-query.dto';

export interface RetrievedKnowledgeChunk {
  articleId: string;
  articleTitle: string;
  category: TicketCategory;
  status: KnowledgeArticleStatus;
  chunkContent: string;
  score: number;
}

interface RetrievalOptions {
  query: string;
  category?: TicketCategory;
  limit?: number;
  includeNonPublished?: boolean;
}

@Injectable()
export class RetrievalService {
  constructor(private readonly prisma: PrismaService) {}

  async searchChunks(
    user: AuthenticatedUser,
    query: SearchKnowledgeQueryDto,
  ): Promise<RetrievedKnowledgeChunk[]> {
    const includeNonPublished =
      Boolean(query.includeNonPublished) &&
      (user.role === Role.SUPPORT_AGENT || user.role === Role.ADMIN);

    return this.retrieve({
      query: query.query ?? '',
      category: query.category,
      limit: query.limit ?? 5,
      includeNonPublished,
    });
  }

  async retrieveForTicket(input: {
    title: string;
    description: string;
    category: TicketCategory;
    limit?: number;
  }): Promise<RetrievedKnowledgeChunk[]> {
    return this.retrieve({
      query: `${input.title} ${input.description}`,
      category: input.category,
      limit: input.limit ?? 5,
      includeNonPublished: false,
    });
  }

  private async retrieve(
    options: RetrievalOptions,
  ): Promise<RetrievedKnowledgeChunk[]> {
    const where: Prisma.KnowledgeBaseArticleWhereInput = {};
    if (!options.includeNonPublished) {
      where.status = KnowledgeArticleStatus.PUBLISHED;
    }
    if (options.category) {
      where.category = options.category;
    }

    const articles = await this.prisma.knowledgeBaseArticle.findMany({
      where,
      include: {
        chunks: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 100,
    });

    const terms = this.normalizeTerms(options.query);
    const results: RetrievedKnowledgeChunk[] = [];

    for (const article of articles) {
      const articleTitle = article.title.toLowerCase();
      const articleContent = article.content.toLowerCase();

      for (const chunk of article.chunks) {
        const chunkContent = chunk.content.toLowerCase();
        const score = this.computeScore({
          terms,
          chunkContent,
          articleTitle,
          articleContent,
          articleCategory: article.category,
          requestedCategory: options.category,
        });

        if (score <= 0) {
          continue;
        }

        results.push({
          articleId: article.id,
          articleTitle: article.title,
          category: article.category,
          status: article.status,
          chunkContent: chunk.content,
          score,
        });
      }
    }

    return results
      .sort((left, right) => right.score - left.score)
      .slice(0, options.limit ?? 5);
  }

  private normalizeTerms(query: string): string[] {
    return Array.from(
      new Set(
        query
          .toLowerCase()
          .split(/[^a-z0-9_]+/)
          .map((value) => value.trim())
          .filter((value) => value.length > 2),
      ),
    );
  }

  private computeScore(input: {
    terms: string[];
    chunkContent: string;
    articleTitle: string;
    articleContent: string;
    articleCategory: TicketCategory;
    requestedCategory?: TicketCategory;
  }): number {
    if (input.terms.length === 0) {
      return input.requestedCategory === input.articleCategory ? 1 : 0.5;
    }

    let score = 0;

    for (const term of input.terms) {
      if (input.chunkContent.includes(term)) {
        score += 3;
      }
      if (input.articleTitle.includes(term)) {
        score += 2;
      }
      if (input.articleContent.includes(term)) {
        score += 1;
      }
    }

    if (
      input.requestedCategory &&
      input.requestedCategory === input.articleCategory
    ) {
      score += 2;
    }

    return Number(score.toFixed(2));
  }
}

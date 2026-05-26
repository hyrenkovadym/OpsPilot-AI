import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { KnowledgeArticleStatus, Prisma, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../common/types/jwt-payload.type';
import { QueuedJobResponseDto } from '../jobs/dto/queued-job-response.dto';
import { JobsService } from '../jobs/jobs.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChunkingService } from './chunking.service';
import { ArticleResponseDto } from './dto/article-response.dto';
import { CreateArticleDto } from './dto/create-article.dto';
import { ListArticlesQueryDto } from './dto/list-articles-query.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

const articleWithCountInclude = {
  _count: {
    select: {
      chunks: true,
    },
  },
} satisfies Prisma.KnowledgeBaseArticleInclude;

type ArticleWithCount = Prisma.KnowledgeBaseArticleGetPayload<{
  include: typeof articleWithCountInclude;
}>;

@Injectable()
export class KnowledgeBaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chunkingService: ChunkingService,
    private readonly auditService: AuditService,
    private readonly jobsService: JobsService,
  ) {}

  async createArticle(
    user: AuthenticatedUser,
    dto: CreateArticleDto,
  ): Promise<ArticleResponseDto> {
    this.assertCanManageArticle(user);

    const article = await this.prisma.knowledgeBaseArticle.create({
      data: {
        title: dto.title,
        content: dto.content,
        category: dto.category,
        status: KnowledgeArticleStatus.DRAFT,
        createdById: user.sub,
      },
    });

    const chunksCount = await this.rebuildChunks(article.id, dto.content);
    const withCount = await this.prisma.knowledgeBaseArticle.findUnique({
      where: { id: article.id },
      include: articleWithCountInclude,
    });
    if (!withCount) {
      throw new NotFoundException('Knowledge article not found');
    }

    await this.auditService.log({
      actorId: user.sub,
      action: 'knowledge_article_created',
      entityType: 'knowledge_article',
      entityId: article.id,
      metadata: {
        category: article.category,
        status: article.status,
        chunksCount,
      },
    });

    return this.mapArticleResponse(withCount);
  }

  async listArticles(
    user: AuthenticatedUser,
    query: ListArticlesQueryDto,
  ): Promise<{
    data: ArticleResponseDto[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where = this.buildListWhere(user, query);
    const [articles, total] = await Promise.all([
      this.prisma.knowledgeBaseArticle.findMany({
        where,
        include: articleWithCountInclude,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.knowledgeBaseArticle.count({ where }),
    ]);

    return {
      data: articles.map((article) => this.mapArticleResponse(article)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getArticleById(
    user: AuthenticatedUser,
    id: string,
  ): Promise<ArticleResponseDto> {
    const article = await this.prisma.knowledgeBaseArticle.findUnique({
      where: { id },
      include: articleWithCountInclude,
    });

    if (!article) {
      throw new NotFoundException('Knowledge article not found');
    }

    if (
      user.role === Role.USER &&
      article.status !== KnowledgeArticleStatus.PUBLISHED
    ) {
      throw new NotFoundException('Knowledge article not found');
    }

    return this.mapArticleResponse(article);
  }

  async updateArticle(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateArticleDto,
  ): Promise<ArticleResponseDto> {
    this.assertCanManageArticle(user);
    const existing = await this.requireArticle(id);

    const data: Prisma.KnowledgeBaseArticleUpdateInput = {
      updatedBy: {
        connect: { id: user.sub },
      },
    };

    if (dto.title !== undefined) {
      data.title = dto.title;
    }
    if (dto.content !== undefined) {
      data.content = dto.content;
    }
    if (dto.category !== undefined) {
      data.category = dto.category;
    }

    await this.prisma.knowledgeBaseArticle.update({
      where: { id },
      data,
      include: articleWithCountInclude,
    });

    if (dto.content !== undefined) {
      await this.rebuildChunks(existing.id, dto.content);
    }

    const article = await this.prisma.knowledgeBaseArticle.findUnique({
      where: { id },
      include: articleWithCountInclude,
    });

    if (!article) {
      throw new NotFoundException('Knowledge article not found');
    }

    await this.auditService.log({
      actorId: user.sub,
      action: 'knowledge_article_updated',
      entityType: 'knowledge_article',
      entityId: article.id,
      metadata: {
        category: article.category,
        status: article.status,
        previousStatus: existing.status,
        chunksCount: article._count.chunks,
      },
    });

    return this.mapArticleResponse(article);
  }

  async deleteArticle(user: AuthenticatedUser, id: string): Promise<void> {
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenException('Only admins can delete knowledge articles');
    }

    const existing = await this.requireArticle(id);
    await this.prisma.knowledgeBaseArticle.delete({
      where: { id },
    });

    await this.auditService.log({
      actorId: user.sub,
      action: 'knowledge_article_deleted',
      entityType: 'knowledge_article',
      entityId: id,
      metadata: {
        category: existing.category,
        status: existing.status,
      },
    });
  }

  async publishArticle(
    user: AuthenticatedUser,
    id: string,
  ): Promise<ArticleResponseDto> {
    this.assertCanManageArticle(user);
    const existing = await this.requireArticle(id);
    await this.rebuildChunks(existing.id, existing.content);

    const article = await this.prisma.knowledgeBaseArticle.update({
      where: { id },
      data: {
        status: KnowledgeArticleStatus.PUBLISHED,
        updatedById: user.sub,
      },
      include: articleWithCountInclude,
    });

    await this.auditService.log({
      actorId: user.sub,
      action: 'knowledge_article_published',
      entityType: 'knowledge_article',
      entityId: id,
      metadata: {
        category: article.category,
        previousStatus: existing.status,
        status: article.status,
        chunksCount: article._count.chunks,
      },
    });

    return this.mapArticleResponse(article);
  }

  async archiveArticle(
    user: AuthenticatedUser,
    id: string,
  ): Promise<ArticleResponseDto> {
    this.assertCanManageArticle(user);
    const existing = await this.requireArticle(id);

    const article = await this.prisma.knowledgeBaseArticle.update({
      where: { id },
      data: {
        status: KnowledgeArticleStatus.ARCHIVED,
        updatedById: user.sub,
      },
      include: articleWithCountInclude,
    });

    await this.auditService.log({
      actorId: user.sub,
      action: 'knowledge_article_archived',
      entityType: 'knowledge_article',
      entityId: id,
      metadata: {
        category: article.category,
        previousStatus: existing.status,
        status: article.status,
      },
    });

    return this.mapArticleResponse(article);
  }

  async rechunkArticle(
    user: AuthenticatedUser,
    id: string,
  ): Promise<ArticleResponseDto | QueuedJobResponseDto> {
    this.assertCanManageArticle(user);
    await this.requireArticle(id);

    if (this.jobsService.isAsyncMode()) {
      return this.jobsService.enqueueKnowledgeRechunk({
        actorId: user.sub,
        articleId: id,
      });
    }

    return this.rechunkArticleSync({
      articleId: id,
      actorId: user.sub,
    });
  }

  async rechunkArticleForJob(input: {
    articleId: string;
    actorId: string;
    backgroundJobId: string;
    queueName: string;
    jobName: string;
  }): Promise<ArticleResponseDto> {
    await this.auditService.log({
      actorId: input.actorId,
      action: 'knowledge_article_rechunk_started',
      entityType: 'knowledge_article',
      entityId: input.articleId,
      metadata: {
        jobId: input.backgroundJobId,
        queueName: input.queueName,
        jobName: input.jobName,
        status: 'PROCESSING',
      },
    });

    try {
      return this.rechunkArticleSync({
        articleId: input.articleId,
        actorId: input.actorId,
        backgroundJobId: input.backgroundJobId,
        queueName: input.queueName,
        jobName: input.jobName,
      });
    } catch (error) {
      await this.auditService.log({
        actorId: input.actorId,
        action: 'knowledge_article_rechunk_failed',
        entityType: 'knowledge_article',
        entityId: input.articleId,
        metadata: {
          jobId: input.backgroundJobId,
          queueName: input.queueName,
          jobName: input.jobName,
          reason: this.safeErrorMessage(error),
        },
      });
      throw error;
    }
  }

  private buildListWhere(
    user: AuthenticatedUser,
    query: ListArticlesQueryDto,
  ): Prisma.KnowledgeBaseArticleWhereInput {
    const where: Prisma.KnowledgeBaseArticleWhereInput = {};

    const canIncludeNonPublished =
      user.role === Role.SUPPORT_AGENT || user.role === Role.ADMIN;
    if (!canIncludeNonPublished) {
      where.status = KnowledgeArticleStatus.PUBLISHED;
    } else if (query.status) {
      where.status = query.status;
    } else if (!query.includeNonPublished) {
      where.status = KnowledgeArticleStatus.PUBLISHED;
    }

    if (query.category) {
      where.category = query.category;
    }

    if (query.search) {
      where.OR = [
        {
          title: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
        {
          content: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
      ];
    }

    return where;
  }

  private mapArticleResponse(article: ArticleWithCount): ArticleResponseDto {
    return {
      id: article.id,
      title: article.title,
      content: article.content,
      category: article.category,
      status: article.status,
      createdById: article.createdById,
      updatedById: article.updatedById,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
      chunksCount: article._count.chunks,
    };
  }

  private assertCanManageArticle(user: AuthenticatedUser): void {
    if (user.role === Role.USER) {
      throw new ForbiddenException(
        'Users are not allowed to manage knowledge base articles',
      );
    }
  }

  private async requireArticle(id: string) {
    const article = await this.prisma.knowledgeBaseArticle.findUnique({
      where: { id },
    });
    if (!article) {
      throw new NotFoundException('Knowledge article not found');
    }
    return article;
  }

  private async rebuildChunks(
    articleId: string,
    content: string,
  ): Promise<number> {
    const chunks = this.chunkingService.chunkText(content);
    await this.prisma.knowledgeBaseChunk.deleteMany({
      where: { articleId },
    });

    if (chunks.length === 0) {
      return 0;
    }

    await this.prisma.knowledgeBaseChunk.createMany({
      data: chunks.map((chunk) => ({
        articleId,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        tokensEstimate: chunk.tokensEstimate,
        embeddingJson: this.createMockEmbedding(chunk.content),
      })),
    });

    return chunks.length;
  }

  private createMockEmbedding(content: string): Prisma.InputJsonValue {
    const values = content
      .toLowerCase()
      .slice(0, 32)
      .split('')
      .map((char) => Number(((char.charCodeAt(0) % 32) / 32).toFixed(2)));
    return values;
  }

  private safeErrorMessage(error: unknown): string {
    const message =
      error instanceof Error ? error.message : 'Knowledge base worker error';
    return message.replace(/sk-[a-zA-Z0-9_-]+/g, '[redacted]').slice(0, 240);
  }

  private async rechunkArticleSync(input: {
    articleId: string;
    actorId: string;
    backgroundJobId?: string;
    queueName?: string;
    jobName?: string;
  }): Promise<ArticleResponseDto> {
    const existing = await this.requireArticle(input.articleId);
    const chunksCount = await this.rebuildChunks(existing.id, existing.content);
    const article = await this.prisma.knowledgeBaseArticle.update({
      where: { id: input.articleId },
      data: {
        updatedById: input.actorId,
      },
      include: articleWithCountInclude,
    });

    await this.auditService.log({
      actorId: input.actorId,
      action: 'knowledge_article_rechunked',
      entityType: 'knowledge_article',
      entityId: input.articleId,
      metadata: {
        jobId: input.backgroundJobId ?? null,
        queueName: input.queueName ?? null,
        jobName: input.jobName ?? null,
        category: article.category,
        status: article.status,
        chunksCount,
      },
    });

    return this.mapArticleResponse(article);
  }
}

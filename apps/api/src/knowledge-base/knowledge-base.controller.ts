import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RateLimit } from '../common/security/rate-limit.decorator';
import { RateLimitGuard } from '../common/security/rate-limit.guard';
import type { AuthenticatedUser } from '../common/types/jwt-payload.type';
import { QueuedJobResponseDto } from '../jobs/dto/queued-job-response.dto';
import { ArticleResponseDto } from './dto/article-response.dto';
import { CreateArticleDto } from './dto/create-article.dto';
import { ListArticlesQueryDto } from './dto/list-articles-query.dto';
import { SearchKnowledgeQueryDto } from './dto/search-knowledge-query.dto';
import { SearchResultDto } from './dto/search-result.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { KnowledgeBaseService } from './knowledge-base.service';
import { RetrievalService } from './retrieval.service';

@ApiTags('knowledge-base')
@ApiExtraModels(ArticleResponseDto, QueuedJobResponseDto)
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('knowledge-base')
export class KnowledgeBaseController {
  constructor(
    private readonly knowledgeBaseService: KnowledgeBaseService,
    private readonly retrievalService: RetrievalService,
    private readonly auditService: AuditService,
  ) {}

  @Post('articles')
  @Roles(Role.SUPPORT_AGENT, Role.ADMIN)
  @ApiOperation({ summary: 'Create knowledge base article' })
  @ApiCreatedResponse({ type: ArticleResponseDto })
  createArticle(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateArticleDto,
  ): Promise<ArticleResponseDto> {
    return this.knowledgeBaseService.createArticle(user, dto);
  }

  @Get('articles')
  @Roles(Role.USER, Role.SUPPORT_AGENT, Role.ADMIN)
  @ApiOperation({ summary: 'List knowledge base articles' })
  @ApiOkResponse({ type: ArticleResponseDto, isArray: true })
  listArticles(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListArticlesQueryDto,
  ) {
    return this.knowledgeBaseService.listArticles(user, query);
  }

  @Get('articles/:id')
  @Roles(Role.USER, Role.SUPPORT_AGENT, Role.ADMIN)
  @ApiOperation({ summary: 'Get knowledge base article by id' })
  @ApiOkResponse({ type: ArticleResponseDto })
  getArticleById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ArticleResponseDto> {
    return this.knowledgeBaseService.getArticleById(user, id);
  }

  @Patch('articles/:id')
  @Roles(Role.SUPPORT_AGENT, Role.ADMIN)
  @ApiOperation({ summary: 'Update knowledge base article' })
  @ApiOkResponse({ type: ArticleResponseDto })
  updateArticle(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateArticleDto,
  ): Promise<ArticleResponseDto> {
    return this.knowledgeBaseService.updateArticle(user, id, dto);
  }

  @Delete('articles/:id')
  @Roles(Role.ADMIN)
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete knowledge base article' })
  @ApiNoContentResponse()
  async deleteArticle(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.knowledgeBaseService.deleteArticle(user, id);
  }

  @Post('articles/:id/publish')
  @Roles(Role.SUPPORT_AGENT, Role.ADMIN)
  @ApiOperation({ summary: 'Publish knowledge base article' })
  @ApiOkResponse({ type: ArticleResponseDto })
  publishArticle(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ArticleResponseDto> {
    return this.knowledgeBaseService.publishArticle(user, id);
  }

  @Post('articles/:id/archive')
  @Roles(Role.SUPPORT_AGENT, Role.ADMIN)
  @ApiOperation({ summary: 'Archive knowledge base article' })
  @ApiOkResponse({ type: ArticleResponseDto })
  archiveArticle(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ArticleResponseDto> {
    return this.knowledgeBaseService.archiveArticle(user, id);
  }

  @Post('articles/:id/rechunk')
  @Roles(Role.SUPPORT_AGENT, Role.ADMIN)
  @ApiOperation({ summary: 'Rebuild article chunks' })
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(ArticleResponseDto) },
        { $ref: getSchemaPath(QueuedJobResponseDto) },
      ],
    },
  })
  rechunkArticle(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ArticleResponseDto | QueuedJobResponseDto> {
    return this.knowledgeBaseService.rechunkArticle(user, id);
  }

  @Get('search')
  @UseGuards(RateLimitGuard)
  @RateLimit({ points: 120, durationSeconds: 60 })
  @Roles(Role.USER, Role.SUPPORT_AGENT, Role.ADMIN)
  @ApiOperation({ summary: 'Search knowledge base chunks' })
  @ApiOkResponse({ type: SearchResultDto, isArray: true })
  async searchKnowledge(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SearchKnowledgeQueryDto,
  ): Promise<SearchResultDto[]> {
    const results = await this.retrievalService.searchChunks(user, query);

    await this.auditService.log({
      actorId: user.sub,
      action: 'knowledge_search_performed',
      entityType: 'knowledge_search',
      entityId: 'knowledge-search',
      metadata: {
        queryLength: (query.query ?? '').length,
        retrievedCount: results.length,
        sourceArticleIds: Array.from(
          new Set(results.map((item) => item.articleId)),
        ),
      },
    });

    return results;
  }
}

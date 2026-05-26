import {
  Body,
  Controller,
  Get,
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
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AiAnalysisResponseDto } from '../ai/dto/ai-analysis-response.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RateLimit } from '../common/security/rate-limit.decorator';
import { RateLimitGuard } from '../common/security/rate-limit.guard';
import type { AuthenticatedUser } from '../common/types/jwt-payload.type';
import { BackgroundJobResponseDto } from '../jobs/dto/background-job-response.dto';
import { QueuedJobResponseDto } from '../jobs/dto/queued-job-response.dto';
import { JobStatusService } from '../jobs/job-status.service';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ListTicketsQueryDto } from './dto/list-tickets-query.dto';
import { TicketDetailResponseDto } from './dto/ticket-detail-response.dto';
import { TicketsListResponseDto } from './dto/tickets-list-response.dto';
import { UpdateTicketPriorityDto } from './dto/update-ticket-priority.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketsService } from './tickets.service';

@ApiTags('tickets')
@ApiExtraModels(AiAnalysisResponseDto, QueuedJobResponseDto)
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tickets')
export class TicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly jobStatusService: JobStatusService,
  ) {}

  @Post()
  @Roles(Role.USER, Role.SUPPORT_AGENT, Role.ADMIN)
  @ApiOperation({ summary: 'Create a support ticket' })
  @ApiCreatedResponse({ type: TicketDetailResponseDto })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTicketDto,
  ): Promise<TicketDetailResponseDto> {
    return this.ticketsService.create(user, dto);
  }

  @Get()
  @Roles(Role.USER, Role.SUPPORT_AGENT, Role.ADMIN)
  @ApiOperation({ summary: 'List tickets with filters and pagination' })
  @ApiOkResponse({ type: TicketsListResponseDto })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListTicketsQueryDto,
  ): Promise<TicketsListResponseDto> {
    return this.ticketsService.findAllForUser(user, query);
  }

  @Get(':id')
  @Roles(Role.USER, Role.SUPPORT_AGENT, Role.ADMIN)
  @ApiOperation({ summary: 'Get ticket detail' })
  @ApiOkResponse({ type: TicketDetailResponseDto })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<TicketDetailResponseDto> {
    return this.ticketsService.findByIdForUser(user, id);
  }

  @Get(':id/jobs')
  @Roles(Role.USER, Role.SUPPORT_AGENT, Role.ADMIN)
  @ApiOperation({ summary: 'List background jobs for a ticket' })
  @ApiOkResponse({ type: BackgroundJobResponseDto, isArray: true })
  listTicketJobs(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<BackgroundJobResponseDto[]> {
    return this.jobStatusService.listTicketJobsForUser(user, id);
  }

  @Patch(':id/status')
  @Roles(Role.USER, Role.SUPPORT_AGENT, Role.ADMIN)
  @ApiOperation({ summary: 'Update ticket status' })
  @ApiOkResponse({ type: TicketDetailResponseDto })
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTicketStatusDto,
  ): Promise<TicketDetailResponseDto> {
    return this.ticketsService.updateStatus(user, id, dto);
  }

  @Patch(':id/assign')
  @Roles(Role.SUPPORT_AGENT, Role.ADMIN)
  @ApiOperation({
    summary:
      'Assign ticket to a support agent/admin (defaults to current user)',
  })
  @ApiOkResponse({ type: TicketDetailResponseDto })
  assignTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AssignTicketDto,
  ): Promise<TicketDetailResponseDto> {
    return this.ticketsService.assignTicket(user, id, dto);
  }

  @Patch(':id/priority')
  @Roles(Role.SUPPORT_AGENT, Role.ADMIN)
  @ApiOperation({ summary: 'Update ticket priority' })
  @ApiOkResponse({ type: TicketDetailResponseDto })
  updatePriority(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTicketPriorityDto,
  ): Promise<TicketDetailResponseDto> {
    return this.ticketsService.updatePriority(user, id, dto);
  }

  @Patch(':id')
  @Roles(Role.USER, Role.SUPPORT_AGENT, Role.ADMIN)
  @ApiOperation({
    summary: 'Update ticket fields (title, description, category)',
  })
  @ApiOkResponse({ type: TicketDetailResponseDto })
  updateTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTicketDto,
  ): Promise<TicketDetailResponseDto> {
    return this.ticketsService.updateTicket(user, id, dto);
  }

  @Post(':id/ai/analyze')
  @UseGuards(RateLimitGuard)
  @RateLimit({ points: 60, durationSeconds: 60 })
  @Roles(Role.USER, Role.SUPPORT_AGENT, Role.ADMIN)
  @ApiOperation({ summary: 'Run AI analysis for a ticket' })
  @ApiCreatedResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(AiAnalysisResponseDto) },
        { $ref: getSchemaPath(QueuedJobResponseDto) },
      ],
    },
  })
  analyzeTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<AiAnalysisResponseDto | QueuedJobResponseDto> {
    return this.ticketsService.analyzeTicket(user, id);
  }

  @Get(':id/ai/suggestion')
  @Roles(Role.USER, Role.SUPPORT_AGENT, Role.ADMIN)
  @ApiOperation({ summary: 'Get AI suggestion for a ticket' })
  @ApiOkResponse({ type: AiAnalysisResponseDto })
  getAiSuggestion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<AiAnalysisResponseDto> {
    return this.ticketsService.getAiSuggestion(user, id);
  }
}

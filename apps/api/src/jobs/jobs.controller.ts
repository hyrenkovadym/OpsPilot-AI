import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthenticatedUser } from '../common/types/jwt-payload.type';
import { BackgroundJobResponseDto } from './dto/background-job-response.dto';
import { JobStatusService } from './job-status.service';

@ApiTags('jobs')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.USER, Role.SUPPORT_AGENT, Role.ADMIN)
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobStatusService: JobStatusService) {}

  @Get('/tickets/:ticketId')
  @ApiOperation({ summary: 'List background jobs for a ticket' })
  @ApiOkResponse({ type: BackgroundJobResponseDto, isArray: true })
  listTicketJobs(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketId', new ParseUUIDPipe()) ticketId: string,
  ): Promise<BackgroundJobResponseDto[]> {
    return this.jobStatusService.listTicketJobsForUser(user, ticketId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get background job status by id' })
  @ApiOkResponse({ type: BackgroundJobResponseDto })
  getJobById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<BackgroundJobResponseDto> {
    return this.jobStatusService.getJobByIdForUser(user, id);
  }
}

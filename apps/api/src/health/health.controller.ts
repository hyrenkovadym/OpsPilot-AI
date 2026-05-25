import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  @ApiOperation({ summary: 'Basic health check' })
  @ApiOkResponse({ description: 'API is running' })
  health() {
    return this.healthService.getHealth();
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness check with PostgreSQL validation' })
  @ApiOkResponse({ description: 'API is ready to serve traffic' })
  ready() {
    return this.healthService.getReadiness();
  }
}

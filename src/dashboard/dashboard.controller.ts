import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { DashboardService, DashboardSummary } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({
    summary:
      'KPIs agregados de la última corrida COMPLETED (0 si nunca corrió ninguna)',
  })
  @ApiResponse({
    status: 200,
    description: 'DashboardSummary de la última corrida COMPLETED',
  })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido' })
  async getSummary(): Promise<DashboardSummary> {
    return this.dashboardService.getSummary();
  }
}

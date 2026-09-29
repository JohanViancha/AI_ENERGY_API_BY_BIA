import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AnalysesRepository } from '../anomalies/analyses.repository';
import type { Analysis } from '../anomalies/entities/analysis.entity';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { RunAnalysisDto } from './dto/run-analysis.dto';
import { AnomalyEngineService } from './engine/anomaly-engine.service';

interface StartAnalysisResponse {
  analysisId: string;
  status: 'RUNNING';
}

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('ai')
export class AiController {
  constructor(
    private readonly anomalyEngineService: AnomalyEngineService,
    private readonly analysesRepository: AnalysesRepository,
  ) {}

  @Post('analyze')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary:
      'Dispara el motor de anomalías en background y retorna el analysisId de inmediato',
  })
  @ApiResponse({
    status: 202,
    description: 'Corrida iniciada, en estado RUNNING',
  })
  @ApiResponse({ status: 400, description: 'Parámetros inválidos' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido' })
  async analyze(@Body() dto: RunAnalysisDto): Promise<StartAnalysisResponse> {
    const analysisId = await this.anomalyEngineService.startAnalysis(dto);
    return { analysisId, status: 'RUNNING' };
  }

  @Get('analysis/:id')
  @ApiOperation({
    summary: 'Estado/resultado de una corrida del motor de anomalías',
  })
  @ApiResponse({ status: 200, description: 'Analysis encontrado' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido' })
  @ApiResponse({ status: 404, description: 'El analysisId no existe' })
  async getAnalysis(@Param('id') id: string): Promise<Analysis> {
    const analysis = await this.analysesRepository.findById(id);

    if (!analysis) {
      throw new NotFoundException(`Analysis ${id} not found`);
    }

    return analysis;
  }
}

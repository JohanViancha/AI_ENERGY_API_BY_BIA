import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { AnomaliesRepository } from './anomalies.repository';
import { ListAnomaliesQueryDto } from './dto/list-anomalies-query.dto';
import { Anomaly } from './entities/anomaly.entity';

@ApiTags('anomalies')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('anomalies')
export class AnomaliesController {
  constructor(private readonly anomaliesRepository: AnomaliesRepository) {}

  @Get()
  @ApiOperation({
    summary:
      'Lista anomalías de una corrida, filtrable por medidor/severidad/tipo',
  })
  @ApiResponse({ status: 200, description: 'Lista de anomalías' })
  @ApiResponse({
    status: 400,
    description: 'Query inválida (analysisId faltante o valores no permitidos)',
  })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido' })
  async list(@Query() query: ListAnomaliesQueryDto): Promise<Anomaly[]> {
    const anomalies = await this.anomaliesRepository.findByAnalysisId(
      query.analysisId,
      query.meterId,
    );

    return anomalies.filter(
      (anomaly) =>
        (!query.severity || anomaly.severity === query.severity) &&
        (!query.type || anomaly.type === query.type),
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Detalle de una anomalía con su evidencia completa',
  })
  @ApiResponse({ status: 200, description: 'Anomalía encontrada' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido' })
  @ApiResponse({ status: 404, description: 'La anomalía no existe' })
  async findOne(@Param('id') id: string): Promise<Anomaly> {
    const anomaly = await this.anomaliesRepository.findById(id);

    if (!anomaly) {
      throw new NotFoundException(`Anomaly ${id} not found`);
    }

    return anomaly;
  }
}

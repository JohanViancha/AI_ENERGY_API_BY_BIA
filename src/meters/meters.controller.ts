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
import { AnalysesRepository } from '../anomalies/analyses.repository';
import { AnomaliesRepository } from '../anomalies/anomalies.repository';
import type { Anomaly } from '../anomalies/entities/anomaly.entity';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { ListReadingsQueryDto } from '../readings/dto/list-readings-query.dto';
import type { Reading } from '../readings/entities/reading.entity';
import { ReadingsRepository } from '../readings/readings.repository';
import { MetersRepository } from './meters.repository';

interface MeterSummary {
  meterId: string;
  lastReadingAt: string | null;
  lastConsumptionKwh: number | null;
  openAnomaliesCount: number;
  highSeverityOpenCount: number;
}

interface MeterDetail extends MeterSummary {
  totalReadingsCount: number;
  lastAnalysisId: string | null;
  anomaliesByType: Record<string, number>;
}

interface PaginatedReadings {
  data: Reading[];
  nextCursor: string | null;
}

@ApiTags('meters')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('meters')
export class MetersController {
  constructor(
    private readonly metersRepository: MetersRepository,
    private readonly readingsRepository: ReadingsRepository,
    private readonly anomaliesRepository: AnomaliesRepository,
    private readonly analysesRepository: AnalysesRepository,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Proyección mínima por medidor (lista)' })
  @ApiResponse({ status: 200, description: 'Lista de MeterSummary' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido' })
  async list(): Promise<MeterSummary[]> {
    const meters = await this.metersRepository.listAll();

    return Promise.all(meters.map((meter) => this.buildSummary(meter.meterId)));
  }

  @Get(':meterId')
  @ApiOperation({ summary: 'Proyección completa de un medidor' })
  @ApiResponse({ status: 200, description: 'MeterDetail del medidor' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido' })
  @ApiResponse({ status: 404, description: 'El medidor no existe' })
  async findOne(@Param('meterId') meterId: string): Promise<MeterDetail> {
    await this.assertMeterExists(meterId);

    return this.buildDetail(meterId);
  }

  @Get(':meterId/readings')
  @ApiOperation({
    summary: 'Lecturas paginadas de un medidor (cursor + rango obligatorio)',
  })
  @ApiResponse({ status: 200, description: 'Página de lecturas' })
  @ApiResponse({
    status: 400,
    description: 'Query inválida (from/to faltantes o mal formados)',
  })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido' })
  @ApiResponse({ status: 404, description: 'El medidor no existe' })
  async readings(
    @Param('meterId') meterId: string,
    @Query() query: ListReadingsQueryDto,
  ): Promise<PaginatedReadings> {
    await this.assertMeterExists(meterId);

    return this.readingsRepository.findByMeterPaginated(
      meterId,
      query.from,
      query.to,
      query.limit,
      query.cursor,
    );
  }

  private async assertMeterExists(meterId: string): Promise<void> {
    const meter = await this.metersRepository.findById(meterId);

    if (!meter) {
      throw new NotFoundException(`Meter ${meterId} not found`);
    }
  }

  private async buildSummary(meterId: string): Promise<MeterSummary> {
    const [latestReading, anomalies] = await Promise.all([
      this.readingsRepository.findLatestByMeter(meterId),
      this.anomaliesRepository.findByMeter(meterId),
    ]);

    return this.toSummary(meterId, latestReading, anomalies);
  }

  private async buildDetail(meterId: string): Promise<MeterDetail> {
    const [latestReading, anomalies, totalReadingsCount, latestAnalysis] =
      await Promise.all([
        this.readingsRepository.findLatestByMeter(meterId),
        this.anomaliesRepository.findByMeter(meterId),
        this.readingsRepository.countByMeter(meterId),
        this.analysesRepository.findLatestByMeter(meterId),
      ]);

    return {
      ...this.toSummary(meterId, latestReading, anomalies),
      totalReadingsCount,
      lastAnalysisId: latestAnalysis?.id ?? null,
      anomaliesByType: MetersController.groupByType(anomalies),
    };
  }

  private toSummary(
    meterId: string,
    latestReading: Reading | null,
    anomalies: Anomaly[],
  ): MeterSummary {
    const openAnomalies = anomalies.filter(
      (anomaly) => anomaly.status === 'OPEN',
    );

    return {
      meterId,
      lastReadingAt: latestReading?.timestamp ?? null,
      lastConsumptionKwh: latestReading?.consumptionKwh ?? null,
      openAnomaliesCount: openAnomalies.length,
      highSeverityOpenCount: openAnomalies.filter(
        (anomaly) => anomaly.severity === 'HIGH',
      ).length,
    };
  }

  private static groupByType(anomalies: Anomaly[]): Record<string, number> {
    return anomalies.reduce<Record<string, number>>((counts, anomaly) => {
      counts[anomaly.type] = (counts[anomaly.type] ?? 0) + 1;
      return counts;
    }, {});
  }
}

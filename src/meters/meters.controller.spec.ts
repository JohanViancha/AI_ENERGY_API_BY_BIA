import { NotFoundException } from '@nestjs/common';
import type { AnalysesRepository } from '../anomalies/analyses.repository';
import type { AnomaliesRepository } from '../anomalies/anomalies.repository';
import type { Anomaly } from '../anomalies/entities/anomaly.entity';
import type { Reading } from '../readings/entities/reading.entity';
import type { ReadingsRepository } from '../readings/readings.repository';
import { MetersController } from './meters.controller';
import type { MetersRepository } from './meters.repository';

function makeAnomaly(overrides: Partial<Anomaly> = {}): Anomaly {
  return {
    id: 'anomaly-1',
    meterId: 'M-001',
    analysisId: 'analysis-123',
    detectedAt: '2026-01-01T00:00:00.000Z',
    type: 'REAL_ANOMALY',
    severity: 'HIGH',
    confidence: 0.9,
    priorityScore: 2.7,
    status: 'OPEN',
    reason: null,
    recommendedAction: null,
    evidence: {
      baselineKwh: 100,
      observedKwh: 250,
      variationPct: 150,
      signals: ['SPIKE'],
      windowStart: '2026-01-01T00:00:00.000Z',
      windowEnd: '2026-01-02T00:00:00.000Z',
      relatedEvents: [],
      detectorScores: { SPIKE: 3.2 },
    },
    ...overrides,
  };
}

function makeReading(overrides: Partial<Reading> = {}): Reading {
  return {
    meterId: 'M-001',
    timestamp: '2026-01-01T00:00:00.000Z',
    consumptionKwh: 42,
    voltage: 220,
    current: 4,
    powerFactor: 0.9,
    status: 'OK',
    ...overrides,
  };
}

function buildController(overrides: {
  metersRepository?: Partial<MetersRepository>;
  readingsRepository?: Partial<ReadingsRepository>;
  anomaliesRepository?: Partial<AnomaliesRepository>;
  analysesRepository?: Partial<AnalysesRepository>;
}) {
  return new MetersController(
    (overrides.metersRepository ?? {}) as MetersRepository,
    (overrides.readingsRepository ?? {}) as ReadingsRepository,
    (overrides.anomaliesRepository ?? {}) as AnomaliesRepository,
    (overrides.analysesRepository ?? {}) as AnalysesRepository,
  );
}

describe('MetersController', () => {
  describe('list', () => {
    it('retorna un MeterSummary por cada medidor', async () => {
      const listAll = jest
        .fn()
        .mockResolvedValue([{ meterId: 'M-001' }, { meterId: 'M-002' }]);
      const findLatestByMeter = jest.fn().mockResolvedValue(makeReading());
      const findByMeter = jest
        .fn()
        .mockResolvedValue([
          makeAnomaly({ status: 'OPEN', severity: 'HIGH' }),
          makeAnomaly({ status: 'RESOLVED', severity: 'HIGH' }),
        ]);
      const controller = buildController({
        metersRepository: { listAll },
        readingsRepository: { findLatestByMeter },
        anomaliesRepository: { findByMeter },
      });

      const result = await controller.list();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        meterId: 'M-001',
        lastReadingAt: '2026-01-01T00:00:00.000Z',
        lastConsumptionKwh: 42,
        openAnomaliesCount: 1,
        highSeverityOpenCount: 1,
      });
    });
  });

  describe('findOne', () => {
    it('lanza 404 cuando el medidor no existe', async () => {
      const findById = jest.fn().mockResolvedValue(null);
      const controller = buildController({
        metersRepository: { findById },
      });

      await expect(controller.findOne('M-inexistente')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('retorna el MeterDetail completo cuando el medidor existe', async () => {
      const findById = jest.fn().mockResolvedValue({ meterId: 'M-001' });
      const findLatestByMeter = jest.fn().mockResolvedValue(makeReading());
      const countByMeter = jest.fn().mockResolvedValue(500);
      const findByMeter = jest.fn().mockResolvedValue([
        makeAnomaly({ type: 'REAL_ANOMALY', status: 'OPEN' }),
        makeAnomaly({ type: 'REAL_ANOMALY', status: 'RESOLVED' }),
        makeAnomaly({
          type: 'DATA_QUALITY',
          status: 'OPEN',
          severity: 'LOW',
        }),
      ]);
      const findLatestByMeterAnalysis = jest
        .fn()
        .mockResolvedValue({ id: 'analysis-9' });
      const controller = buildController({
        metersRepository: { findById },
        readingsRepository: { findLatestByMeter, countByMeter },
        anomaliesRepository: { findByMeter },
        analysesRepository: { findLatestByMeter: findLatestByMeterAnalysis },
      });

      const result = await controller.findOne('M-001');

      expect(result).toEqual({
        meterId: 'M-001',
        lastReadingAt: '2026-01-01T00:00:00.000Z',
        lastConsumptionKwh: 42,
        openAnomaliesCount: 2,
        highSeverityOpenCount: 1,
        totalReadingsCount: 500,
        lastAnalysisId: 'analysis-9',
        anomaliesByType: { REAL_ANOMALY: 2, DATA_QUALITY: 1 },
      });
    });
  });

  describe('readings', () => {
    it('lanza 404 cuando el medidor no existe', async () => {
      const findById = jest.fn().mockResolvedValue(null);
      const controller = buildController({
        metersRepository: { findById },
      });

      await expect(
        controller.readings('M-inexistente', {
          from: '2026-01-01T00:00:00.000Z',
          to: '2026-01-02T00:00:00.000Z',
          limit: 100,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('delega la paginación en ReadingsRepository.findByMeterPaginated', async () => {
      const findById = jest.fn().mockResolvedValue({ meterId: 'M-001' });
      const paginatedResult = {
        data: [makeReading()],
        nextCursor: '2026-01-01T01:00:00.000Z',
      };
      const findByMeterPaginated = jest.fn().mockResolvedValue(paginatedResult);
      const controller = buildController({
        metersRepository: { findById },
        readingsRepository: { findByMeterPaginated },
      });

      const result = await controller.readings('M-001', {
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-01-02T00:00:00.000Z',
        limit: 50,
        cursor: '2026-01-01T00:00:00.000Z',
      });

      expect(findByMeterPaginated).toHaveBeenCalledWith(
        'M-001',
        '2026-01-01T00:00:00.000Z',
        '2026-01-02T00:00:00.000Z',
        50,
        '2026-01-01T00:00:00.000Z',
      );
      expect(result).toEqual(paginatedResult);
    });
  });
});

import { NotFoundException } from '@nestjs/common';
import { AnomaliesController } from './anomalies.controller';
import type { AnomaliesRepository } from './anomalies.repository';
import type { Anomaly } from './entities/anomaly.entity';

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

describe('AnomaliesController', () => {
  describe('list', () => {
    it('delega en findByAnalysisId con analysisId y meterId', async () => {
      const anomalies = [makeAnomaly()];
      const findByAnalysisId = jest.fn().mockResolvedValue(anomalies);
      const controller = new AnomaliesController({
        findByAnalysisId,
      } as unknown as AnomaliesRepository);

      const result = await controller.list({
        analysisId: 'analysis-123',
        meterId: 'M-001',
      });

      expect(findByAnalysisId).toHaveBeenCalledWith('analysis-123', 'M-001');
      expect(result).toEqual(anomalies);
    });

    it('filtra en memoria por severity', async () => {
      const anomalies = [
        makeAnomaly({ id: 'a-high', severity: 'HIGH' }),
        makeAnomaly({ id: 'a-low', severity: 'LOW' }),
      ];
      const findByAnalysisId = jest.fn().mockResolvedValue(anomalies);
      const controller = new AnomaliesController({
        findByAnalysisId,
      } as unknown as AnomaliesRepository);

      const result = await controller.list({
        analysisId: 'analysis-123',
        severity: 'HIGH',
      });

      expect(result).toEqual([anomalies[0]]);
    });

    it('filtra en memoria por type', async () => {
      const anomalies = [
        makeAnomaly({ id: 'a-real', type: 'REAL_ANOMALY' }),
        makeAnomaly({ id: 'a-quality', type: 'DATA_QUALITY' }),
      ];
      const findByAnalysisId = jest.fn().mockResolvedValue(anomalies);
      const controller = new AnomaliesController({
        findByAnalysisId,
      } as unknown as AnomaliesRepository);

      const result = await controller.list({
        analysisId: 'analysis-123',
        type: 'DATA_QUALITY',
      });

      expect(result).toEqual([anomalies[1]]);
    });
  });

  describe('findOne', () => {
    it('retorna la anomalía cuando existe', async () => {
      const anomaly = makeAnomaly();
      const findById = jest.fn().mockResolvedValue(anomaly);
      const controller = new AnomaliesController({
        findById,
      } as unknown as AnomaliesRepository);

      const result = await controller.findOne('anomaly-1');

      expect(findById).toHaveBeenCalledWith('anomaly-1');
      expect(result).toEqual(anomaly);
    });

    it('lanza 404 cuando no existe', async () => {
      const findById = jest.fn().mockResolvedValue(null);
      const controller = new AnomaliesController({
        findById,
      } as unknown as AnomaliesRepository);

      await expect(controller.findOne('missing-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});

import { NotFoundException } from '@nestjs/common';
import type { AnalysesRepository } from '../anomalies/analyses.repository';
import type { Analysis } from '../anomalies/entities/analysis.entity';
import { AiController } from './ai.controller';
import type { AnomalyEngineService } from './engine/anomaly-engine.service';

function makeAnalysis(overrides: Partial<Analysis> = {}): Analysis {
  return {
    id: 'analysis-1',
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: null,
    status: 'RUNNING',
    errorCode: null,
    errorMessage: null,
    triggeredBy: 'MANUAL',
    metersAnalyzed: ['M-001'],
    progress: { phase: 'READINGS', pct: 10 },
    anomaliesCount: 0,
    highPriorityCount: 0,
    ...overrides,
  };
}

describe('AiController', () => {
  describe('analyze', () => {
    it('dispara startAnalysis y retorna { analysisId, status: RUNNING } de inmediato', async () => {
      const startAnalysis = jest.fn().mockResolvedValue('analysis-1');
      const controller = new AiController(
        { startAnalysis } as unknown as AnomalyEngineService,
        {} as unknown as AnalysesRepository,
      );

      const result = await controller.analyze({ meterIds: ['M-001'] });

      expect(startAnalysis).toHaveBeenCalledWith({ meterIds: ['M-001'] });
      expect(result).toEqual({ analysisId: 'analysis-1', status: 'RUNNING' });
    });
  });

  describe('getAnalysis', () => {
    it('retorna el Analysis cuando existe', async () => {
      const analysis = makeAnalysis();
      const findById = jest.fn().mockResolvedValue(analysis);
      const controller = new AiController(
        {} as unknown as AnomalyEngineService,
        { findById } as unknown as AnalysesRepository,
      );

      const result = await controller.getAnalysis('analysis-1');

      expect(findById).toHaveBeenCalledWith('analysis-1');
      expect(result).toEqual(analysis);
    });

    it('lanza 404 cuando el análisis no existe', async () => {
      const findById = jest.fn().mockResolvedValue(null);
      const controller = new AiController(
        {} as unknown as AnomalyEngineService,
        { findById } as unknown as AnalysesRepository,
      );

      await expect(controller.getAnalysis('missing-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});

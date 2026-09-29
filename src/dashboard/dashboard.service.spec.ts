import type { AnalysesRepository } from '../anomalies/analyses.repository';
import type { AnomaliesRepository } from '../anomalies/anomalies.repository';
import type { Analysis } from '../anomalies/entities/analysis.entity';
import type { Anomaly } from '../anomalies/entities/anomaly.entity';
import { DashboardService } from './dashboard.service';

function makeAnalysis(overrides: Partial<Analysis> = {}): Analysis {
  return {
    id: 'analysis-1',
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: '2026-01-01T01:00:00.000Z',
    status: 'COMPLETED',
    errorCode: null,
    errorMessage: null,
    triggeredBy: 'MANUAL',
    metersAnalyzed: ['M-001'],
    progress: { phase: 'RECOMMENDATION', pct: 100 },
    anomaliesCount: 0,
    highPriorityCount: 0,
    ...overrides,
  };
}

function makeAnomaly(overrides: Partial<Anomaly> = {}): Anomaly {
  return {
    id: 'anomaly-1',
    meterId: 'M-001',
    analysisId: 'analysis-1',
    detectedAt: '2026-01-01T00:00:00.000Z',
    type: 'REAL_ANOMALY',
    severity: 'HIGH',
    confidence: 0.8,
    priorityScore: 2.4,
    status: 'OPEN',
    reason: null,
    recommendedAction: null,
    evidence: {
      baselineKwh: 100,
      observedKwh: 200,
      variationPct: 100,
      signals: ['SPIKE'],
      windowStart: '2026-01-01T00:00:00.000Z',
      windowEnd: '2026-01-01T01:00:00.000Z',
      relatedEvents: [],
      detectorScores: { SPIKE: 3 },
    },
    ...overrides,
  };
}

describe('DashboardService', () => {
  it('retorna analysisId null y contadores en 0 cuando nunca corrió una COMPLETED', async () => {
    const findLatestCompleted = jest.fn().mockResolvedValue(null);
    const findByAnalysisId = jest.fn();
    const service = new DashboardService(
      { findLatestCompleted } as unknown as AnalysesRepository,
      { findByAnalysisId } as unknown as AnomaliesRepository,
    );

    const result = await service.getSummary();

    expect(result).toEqual({
      analysisId: null,
      finishedAt: null,
      anomaliesCount: 0,
      bySeverity: { HIGH: 0, MEDIUM: 0, LOW: 0 },
      byType: {},
      avgConfidence: null,
    });
    expect(findByAnalysisId).not.toHaveBeenCalled();
  });

  it('agrega bySeverity/byType/avgConfidence sobre las anomalías de la última corrida COMPLETED', async () => {
    const analysis = makeAnalysis();
    const findLatestCompleted = jest.fn().mockResolvedValue(analysis);
    const anomalies = [
      makeAnomaly({ severity: 'HIGH', type: 'REAL_ANOMALY', confidence: 0.9 }),
      makeAnomaly({ severity: 'HIGH', type: 'DATA_QUALITY', confidence: 0.5 }),
      makeAnomaly({ severity: 'LOW', type: 'REAL_ANOMALY', confidence: 0.4 }),
    ];
    const findByAnalysisId = jest.fn().mockResolvedValue(anomalies);
    const service = new DashboardService(
      { findLatestCompleted } as unknown as AnalysesRepository,
      { findByAnalysisId } as unknown as AnomaliesRepository,
    );

    const result = await service.getSummary();

    expect(findByAnalysisId).toHaveBeenCalledWith('analysis-1');
    expect(result).toEqual({
      analysisId: 'analysis-1',
      finishedAt: '2026-01-01T01:00:00.000Z',
      anomaliesCount: 3,
      bySeverity: { HIGH: 2, MEDIUM: 0, LOW: 1 },
      byType: { REAL_ANOMALY: 2, DATA_QUALITY: 1 },
      avgConfidence: (0.9 + 0.5 + 0.4) / 3,
    });
  });

  it('retorna avgConfidence null cuando la última corrida COMPLETED no tiene anomalías', async () => {
    const analysis = makeAnalysis();
    const findLatestCompleted = jest.fn().mockResolvedValue(analysis);
    const findByAnalysisId = jest.fn().mockResolvedValue([]);
    const service = new DashboardService(
      { findLatestCompleted } as unknown as AnalysesRepository,
      { findByAnalysisId } as unknown as AnomaliesRepository,
    );

    const result = await service.getSummary();

    expect(result.anomaliesCount).toBe(0);
    expect(result.avgConfidence).toBeNull();
  });
});

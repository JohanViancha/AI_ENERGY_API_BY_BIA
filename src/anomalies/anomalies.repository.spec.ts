import type { FirebaseService } from '../firebase/firebase.service';
import { AnomaliesRepository } from './anomalies.repository';

function createQueryMock(docs: unknown[]) {
  const query = {
    where: jest.fn(),
    orderBy: jest.fn(),
    get: jest.fn().mockResolvedValue({ docs }),
  };
  query.where.mockReturnValue(query);
  query.orderBy.mockReturnValue(query);
  return query;
}

function anomalyDoc(id: string, overrides: Partial<Record<string, unknown>>) {
  return {
    id,
    data: () => ({
      meter_id: 'M-001',
      analysis_id: 'analysis-123',
      detected_at: '2026-01-01T00:00:00.000Z',
      type: 'REAL_ANOMALY',
      severity: 'HIGH',
      confidence: 0.9,
      priority_score: 2.7,
      status: 'OPEN',
      reason: null,
      recommended_action: null,
      evidence: {
        baseline_kwh: 100,
        observed_kwh: 250,
        variation_pct: 150,
        signals: ['SPIKE'],
        window_start: '2026-01-01T00:00:00.000Z',
        window_end: '2026-01-02T00:00:00.000Z',
        related_events: [],
        detector_scores: { SPIKE: 3.2 },
      },
      ...overrides,
    }),
  };
}

describe('AnomaliesRepository', () => {
  it('findByAnalysisId queries by analysis_id, ordered by priority_score desc', async () => {
    const docs = [anomalyDoc('anomaly-1', {})];
    const query = createQueryMock(docs);
    const collection = jest.fn().mockReturnValue(query);
    const firebaseService = {
      getFirestore: jest.fn().mockReturnValue({ collection }),
    } as unknown as FirebaseService;

    const repository = new AnomaliesRepository(firebaseService);
    const result = await repository.findByAnalysisId('analysis-123');

    expect(collection).toHaveBeenCalledWith('anomalies');
    expect(query.where).toHaveBeenCalledWith(
      'analysis_id',
      '==',
      'analysis-123',
    );
    expect(query.orderBy).toHaveBeenCalledWith('priority_score', 'desc');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('anomaly-1');
    expect(result[0].priorityScore).toBe(2.7);
  });

  it('findByMeter queries by meter_id, ordered by detected_at desc', async () => {
    const docs = [anomalyDoc('anomaly-2', {})];
    const query = createQueryMock(docs);
    const collection = jest.fn().mockReturnValue(query);
    const firebaseService = {
      getFirestore: jest.fn().mockReturnValue({ collection }),
    } as unknown as FirebaseService;

    const repository = new AnomaliesRepository(firebaseService);
    const result = await repository.findByMeter('M-001');

    expect(collection).toHaveBeenCalledWith('anomalies');
    expect(query.where).toHaveBeenCalledWith('meter_id', '==', 'M-001');
    expect(query.orderBy).toHaveBeenCalledWith('detected_at', 'desc');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('anomaly-2');
    expect(result[0].meterId).toBe('M-001');
  });

  it('returns an empty array when there are no matches', async () => {
    const query = createQueryMock([]);
    const collection = jest.fn().mockReturnValue(query);
    const firebaseService = {
      getFirestore: jest.fn().mockReturnValue({ collection }),
    } as unknown as FirebaseService;

    const repository = new AnomaliesRepository(firebaseService);
    const result = await repository.findByAnalysisId('analysis-empty');

    expect(result).toEqual([]);
  });
});

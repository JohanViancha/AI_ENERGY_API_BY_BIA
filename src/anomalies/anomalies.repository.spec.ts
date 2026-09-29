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

  it('findByAnalysisId también filtra por meter_id en Firestore cuando se lo pasa', async () => {
    const docs = [anomalyDoc('anomaly-1', {})];
    const query = createQueryMock(docs);
    const collection = jest.fn().mockReturnValue(query);
    const firebaseService = {
      getFirestore: jest.fn().mockReturnValue({ collection }),
    } as unknown as FirebaseService;

    const repository = new AnomaliesRepository(firebaseService);
    const result = await repository.findByAnalysisId('analysis-123', 'M-001');

    expect(query.where).toHaveBeenCalledWith(
      'analysis_id',
      '==',
      'analysis-123',
    );
    expect(query.where).toHaveBeenCalledWith('meter_id', '==', 'M-001');
    expect(query.orderBy).toHaveBeenCalledWith('priority_score', 'desc');
    expect(result).toHaveLength(1);
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

  describe('findById', () => {
    it('retorna la anomalía cuando el documento existe', async () => {
      const doc = anomalyDoc('anomaly-1', {});
      const getFn = jest.fn().mockResolvedValue({ exists: true, ...doc });
      const docFn = jest.fn().mockReturnValue({ get: getFn });
      const collection = jest.fn().mockReturnValue({ doc: docFn });
      const firebaseService = {
        getFirestore: jest.fn().mockReturnValue({ collection }),
      } as unknown as FirebaseService;

      const repository = new AnomaliesRepository(firebaseService);
      const result = await repository.findById('anomaly-1');

      expect(collection).toHaveBeenCalledWith('anomalies');
      expect(docFn).toHaveBeenCalledWith('anomaly-1');
      expect(result?.id).toBe('anomaly-1');
      expect(result?.meterId).toBe('M-001');
    });

    it('retorna null cuando el documento no existe', async () => {
      const getFn = jest.fn().mockResolvedValue({ exists: false });
      const docFn = jest.fn().mockReturnValue({ get: getFn });
      const collection = jest.fn().mockReturnValue({ doc: docFn });
      const firebaseService = {
        getFirestore: jest.fn().mockReturnValue({ collection }),
      } as unknown as FirebaseService;

      const repository = new AnomaliesRepository(firebaseService);
      const result = await repository.findById('anomaly-inexistente');

      expect(result).toBeNull();
    });
  });

  function makeAnomalyInput(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      meterId: 'M-001',
      analysisId: 'analysis-123',
      detectedAt: '2026-01-01T00:00:00.000Z',
      type: 'REAL_ANOMALY' as const,
      severity: 'HIGH' as const,
      confidence: 0.9,
      priorityScore: 2.7,
      status: 'OPEN' as const,
      reason: 'porque sí',
      recommendedAction: 'investigar',
      evidence: {
        baselineKwh: 100,
        observedKwh: 250,
        variationPct: 150,
        signals: ['Z_SCORE'],
        windowStart: '2026-01-01T00:00:00.000Z',
        windowEnd: '2026-01-02T00:00:00.000Z',
        relatedEvents: [],
        detectorScores: { Z_SCORE: 5 },
      },
      ...overrides,
    };
  }

  describe('createMany', () => {
    it('escribe cada anomalía con un id autogenerado usando un batch y retorna los ids', async () => {
      const docRefs = [{ id: 'anomaly-a' }, { id: 'anomaly-b' }];
      let callCount = 0;
      const docFn = jest.fn().mockImplementation(() => docRefs[callCount++]);
      const collection = jest.fn().mockReturnValue({ doc: docFn });
      const batchSet = jest.fn();
      const batchCommit = jest.fn().mockResolvedValue(undefined);
      const batch = jest
        .fn()
        .mockReturnValue({ set: batchSet, commit: batchCommit });
      const firebaseService = {
        getFirestore: jest.fn().mockReturnValue({ collection, batch }),
      } as unknown as FirebaseService;

      const repository = new AnomaliesRepository(firebaseService);
      const ids = await repository.createMany([
        makeAnomalyInput(),
        makeAnomalyInput({ meterId: 'M-002' }),
      ]);

      expect(collection).toHaveBeenCalledWith('anomalies');
      expect(docFn).toHaveBeenCalledTimes(2);
      expect(batchSet).toHaveBeenCalledTimes(2);
      expect(batchSet).toHaveBeenNthCalledWith(
        1,
        docRefs[0],
        expect.objectContaining({ meter_id: 'M-001' }),
      );
      expect(batchSet).toHaveBeenNthCalledWith(
        2,
        docRefs[1],
        expect.objectContaining({ meter_id: 'M-002' }),
      );
      expect(batchCommit).toHaveBeenCalledTimes(1);
      expect(ids).toEqual(['anomaly-a', 'anomaly-b']);
    });

    it('no toca Firestore cuando el array de anomalías está vacío', async () => {
      const batch = jest.fn();
      const collection = jest.fn();
      const firebaseService = {
        getFirestore: jest.fn().mockReturnValue({ collection, batch }),
      } as unknown as FirebaseService;

      const repository = new AnomaliesRepository(firebaseService);
      const ids = await repository.createMany([]);

      expect(ids).toEqual([]);
      expect(batch).not.toHaveBeenCalled();
      expect(collection).not.toHaveBeenCalled();
    });
  });
});

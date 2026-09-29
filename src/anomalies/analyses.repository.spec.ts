import type { FirebaseService } from '../firebase/firebase.service';
import { AnalysesRepository } from './analyses.repository';
import type { AnalysisFirestoreDoc } from './entities/analysis.entity';

function createQueryMock(docs: unknown[]) {
  const query = {
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    get: jest.fn().mockResolvedValue({ docs }),
  };
  query.where.mockReturnValue(query);
  query.orderBy.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  return query;
}

function analysisDoc(
  id: string,
  overrides: Partial<Record<string, unknown>> = {},
) {
  return {
    id,
    data: () => ({
      started_at: '2026-01-01T00:00:00.000Z',
      finished_at: '2026-01-01T01:00:00.000Z',
      status: 'COMPLETED',
      error_code: null,
      error_message: null,
      triggered_by: 'MANUAL',
      meters_analyzed: ['M-001'],
      progress: { phase: 'RECOMMENDATION', pct: 100 },
      anomalies_count: 3,
      high_priority_count: 1,
      ...overrides,
    }),
  };
}

describe('AnalysesRepository', () => {
  it('findById returns the Analysis mapped from the Firestore doc when it exists', async () => {
    const docSnapshot = {
      exists: true,
      id: 'analysis-123',
      data: () => ({
        started_at: '2026-01-01T00:00:00.000Z',
        finished_at: null,
        status: 'RUNNING',
        error_code: null,
        error_message: null,
        triggered_by: 'MANUAL',
        meters_analyzed: ['M-001'],
        progress: { phase: 'BASELINE', pct: 20 },
        anomalies_count: 0,
        high_priority_count: 0,
      }),
    };
    const get = jest.fn().mockResolvedValue(docSnapshot);
    const doc = jest.fn().mockReturnValue({ get });
    const collection = jest.fn().mockReturnValue({ doc });
    const firebaseService = {
      getFirestore: jest.fn().mockReturnValue({ collection }),
    } as unknown as FirebaseService;

    const repository = new AnalysesRepository(firebaseService);
    const result = await repository.findById('analysis-123');

    expect(collection).toHaveBeenCalledWith('analyses');
    expect(doc).toHaveBeenCalledWith('analysis-123');
    expect(result).toEqual({
      id: 'analysis-123',
      startedAt: '2026-01-01T00:00:00.000Z',
      finishedAt: null,
      status: 'RUNNING',
      errorCode: null,
      errorMessage: null,
      triggeredBy: 'MANUAL',
      metersAnalyzed: ['M-001'],
      progress: { phase: 'BASELINE', pct: 20 },
      anomaliesCount: 0,
      highPriorityCount: 0,
    });
  });

  it('findById returns null when the document does not exist', async () => {
    const get = jest.fn().mockResolvedValue({ exists: false });
    const doc = jest.fn().mockReturnValue({ get });
    const collection = jest.fn().mockReturnValue({ doc });
    const firebaseService = {
      getFirestore: jest.fn().mockReturnValue({ collection }),
    } as unknown as FirebaseService;

    const repository = new AnalysesRepository(firebaseService);
    const result = await repository.findById('missing-id');

    expect(result).toBeNull();
  });

  it('create writes a RUNNING analysis with default progress/counters and returns the generated id', async () => {
    const add = jest.fn().mockResolvedValue({ id: 'analysis-new' });
    const collection = jest.fn().mockReturnValue({ add });
    const firebaseService = {
      getFirestore: jest.fn().mockReturnValue({ collection }),
    } as unknown as FirebaseService;

    const repository = new AnalysesRepository(firebaseService);
    const id = await repository.create({ metersAnalyzed: ['M-001', 'M-002'] });

    expect(collection).toHaveBeenCalledWith('analyses');
    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'RUNNING',
        finished_at: null,
        error_code: null,
        error_message: null,
        triggered_by: 'MANUAL',
        meters_analyzed: ['M-001', 'M-002'],
        progress: { phase: 'READINGS', pct: 0 },
        anomalies_count: 0,
        high_priority_count: 0,
      }),
    );
    expect(id).toBe('analysis-new');
  });

  it('create respects an explicit triggeredBy', async () => {
    const add = jest.fn().mockResolvedValue({ id: 'analysis-new' });
    const collection = jest.fn().mockReturnValue({ add });
    const firebaseService = {
      getFirestore: jest.fn().mockReturnValue({ collection }),
    } as unknown as FirebaseService;

    const repository = new AnalysesRepository(firebaseService);
    await repository.create({ metersAnalyzed: [], triggeredBy: 'SCHEDULED' });

    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({ triggered_by: 'SCHEDULED' }),
    );
  });

  it('updateProgress writes only the progress field for the given phase/pct', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const doc = jest.fn().mockReturnValue({ update });
    const collection = jest.fn().mockReturnValue({ doc });
    const firebaseService = {
      getFirestore: jest.fn().mockReturnValue({ collection }),
    } as unknown as FirebaseService;

    const repository = new AnalysesRepository(firebaseService);
    await repository.updateProgress('analysis-123', 'DETECTION', 40);

    expect(doc).toHaveBeenCalledWith('analysis-123');
    expect(update).toHaveBeenCalledWith({
      progress: { phase: 'DETECTION', pct: 40 },
    });
  });

  it('finish writes status, finishedAt and error fields when the run completes without counts', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const doc = jest.fn().mockReturnValue({ update });
    const collection = jest.fn().mockReturnValue({ doc });
    const firebaseService = {
      getFirestore: jest.fn().mockReturnValue({ collection }),
    } as unknown as FirebaseService;

    const repository = new AnalysesRepository(firebaseService);
    await repository.finish('analysis-123', 'FAILED', 'DETECTOR_ERROR', 'boom');

    expect(doc).toHaveBeenCalledWith('analysis-123');
    const [updateArg] = update.mock.calls[0] as [Partial<AnalysisFirestoreDoc>];
    expect(updateArg.status).toBe('FAILED');
    expect(updateArg.error_code).toBe('DETECTOR_ERROR');
    expect(updateArg.error_message).toBe('boom');
    expect(updateArg.finished_at).toEqual(expect.any(String));
    expect(updateArg.anomalies_count).toBeUndefined();
    expect(updateArg.high_priority_count).toBeUndefined();
  });

  it('finish includes anomaliesCount/highPriorityCount when provided (run completed)', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const doc = jest.fn().mockReturnValue({ update });
    const collection = jest.fn().mockReturnValue({ doc });
    const firebaseService = {
      getFirestore: jest.fn().mockReturnValue({ collection }),
    } as unknown as FirebaseService;

    const repository = new AnalysesRepository(firebaseService);
    await repository.finish('analysis-123', 'COMPLETED', null, null, 5, 2);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'COMPLETED',
        error_code: null,
        error_message: null,
        anomalies_count: 5,
        high_priority_count: 2,
      }),
    );
  });

  describe('findLatestCompleted', () => {
    it('filtra por status COMPLETED, ordena por started_at desc y limita a 1', async () => {
      const query = createQueryMock([analysisDoc('analysis-1')]);
      const collection = jest.fn().mockReturnValue(query);
      const firebaseService = {
        getFirestore: jest.fn().mockReturnValue({ collection }),
      } as unknown as FirebaseService;

      const repository = new AnalysesRepository(firebaseService);
      const result = await repository.findLatestCompleted();

      expect(collection).toHaveBeenCalledWith('analyses');
      expect(query.where).toHaveBeenCalledWith('status', '==', 'COMPLETED');
      expect(query.orderBy).toHaveBeenCalledWith('started_at', 'desc');
      expect(query.limit).toHaveBeenCalledWith(1);
      expect(result?.id).toBe('analysis-1');
      expect(result?.status).toBe('COMPLETED');
    });

    it('retorna null cuando nunca corrió una COMPLETED', async () => {
      const query = createQueryMock([]);
      const collection = jest.fn().mockReturnValue(query);
      const firebaseService = {
        getFirestore: jest.fn().mockReturnValue({ collection }),
      } as unknown as FirebaseService;

      const repository = new AnalysesRepository(firebaseService);
      const result = await repository.findLatestCompleted();

      expect(result).toBeNull();
    });
  });

  describe('findLatestByMeter', () => {
    it('filtra por meters_analyzed array-contains, ordena por started_at desc y limita a 1', async () => {
      const query = createQueryMock([
        analysisDoc('analysis-2', { meters_analyzed: ['M-001', 'M-002'] }),
      ]);
      const collection = jest.fn().mockReturnValue(query);
      const firebaseService = {
        getFirestore: jest.fn().mockReturnValue({ collection }),
      } as unknown as FirebaseService;

      const repository = new AnalysesRepository(firebaseService);
      const result = await repository.findLatestByMeter('M-001');

      expect(collection).toHaveBeenCalledWith('analyses');
      expect(query.where).toHaveBeenCalledWith(
        'meters_analyzed',
        'array-contains',
        'M-001',
      );
      expect(query.orderBy).toHaveBeenCalledWith('started_at', 'desc');
      expect(query.limit).toHaveBeenCalledWith(1);
      expect(result?.id).toBe('analysis-2');
    });

    it('retorna null cuando el medidor nunca fue analizado', async () => {
      const query = createQueryMock([]);
      const collection = jest.fn().mockReturnValue(query);
      const firebaseService = {
        getFirestore: jest.fn().mockReturnValue({ collection }),
      } as unknown as FirebaseService;

      const repository = new AnalysesRepository(firebaseService);
      const result = await repository.findLatestByMeter('M-sin-analisis');

      expect(result).toBeNull();
    });
  });
});

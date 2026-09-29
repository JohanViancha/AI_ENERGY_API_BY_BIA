import type { FirebaseService } from '../firebase/firebase.service';
import { ReadingsRepository } from './readings.repository';

function createQueryMock(docs: unknown[]) {
  const query = {
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    count: jest.fn(),
    get: jest.fn().mockResolvedValue({ docs }),
  };
  query.where.mockReturnValue(query);
  query.orderBy.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  return query;
}

function readingDoc(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    data: () => ({
      meter_id: 'M-001',
      timestamp: '2026-01-01T00:00:00.000Z',
      consumption_kwh: 10,
      voltage: 220,
      current: 4,
      power_factor: 0.9,
      status: 'OK',
      ...overrides,
    }),
  };
}

describe('ReadingsRepository', () => {
  it('findByMeterAndRange queries by meter_id and timestamp range, ordered ascending', async () => {
    const docs = [
      {
        data: () => ({
          meter_id: 'M-001',
          timestamp: '2026-01-01T00:00:00.000Z',
          consumption_kwh: 10,
          voltage: 220,
          current: 4,
          power_factor: 0.9,
          status: 'OK',
        }),
      },
    ];
    const query = createQueryMock(docs);
    const collection = jest.fn().mockReturnValue(query);
    const firebaseService = {
      getFirestore: jest.fn().mockReturnValue({ collection }),
    } as unknown as FirebaseService;

    const repository = new ReadingsRepository(firebaseService);
    const result = await repository.findByMeterAndRange(
      'M-001',
      '2026-01-01T00:00:00.000Z',
      '2026-01-02T00:00:00.000Z',
    );

    expect(collection).toHaveBeenCalledWith('readings');
    expect(query.where).toHaveBeenCalledWith('meter_id', '==', 'M-001');
    expect(query.where).toHaveBeenCalledWith(
      'timestamp',
      '>=',
      '2026-01-01T00:00:00.000Z',
    );
    expect(query.where).toHaveBeenCalledWith(
      'timestamp',
      '<=',
      '2026-01-02T00:00:00.000Z',
    );
    expect(query.orderBy).toHaveBeenCalledWith('timestamp', 'asc');
    expect(result).toEqual([
      {
        meterId: 'M-001',
        timestamp: '2026-01-01T00:00:00.000Z',
        consumptionKwh: 10,
        voltage: 220,
        current: 4,
        powerFactor: 0.9,
        status: 'OK',
      },
    ]);
  });

  describe('findLatestByMeter', () => {
    it('retorna la última lectura ordenando por timestamp desc con limit 1', async () => {
      const query = createQueryMock([readingDoc()]);
      const collection = jest.fn().mockReturnValue(query);
      const firebaseService = {
        getFirestore: jest.fn().mockReturnValue({ collection }),
      } as unknown as FirebaseService;

      const repository = new ReadingsRepository(firebaseService);
      const result = await repository.findLatestByMeter('M-001');

      expect(query.where).toHaveBeenCalledWith('meter_id', '==', 'M-001');
      expect(query.orderBy).toHaveBeenCalledWith('timestamp', 'desc');
      expect(query.limit).toHaveBeenCalledWith(1);
      expect(result?.meterId).toBe('M-001');
    });

    it('retorna null cuando el medidor no tiene lecturas', async () => {
      const query = createQueryMock([]);
      const collection = jest.fn().mockReturnValue(query);
      const firebaseService = {
        getFirestore: jest.fn().mockReturnValue({ collection }),
      } as unknown as FirebaseService;

      const repository = new ReadingsRepository(firebaseService);
      const result = await repository.findLatestByMeter('M-sin-lecturas');

      expect(result).toBeNull();
    });
  });

  describe('countByMeter', () => {
    it('retorna el conteo de lecturas del medidor usando una aggregate query', async () => {
      const countGet = jest
        .fn()
        .mockResolvedValue({ data: () => ({ count: 42 }) });
      const countQuery = {
        count: jest.fn().mockReturnValue({ get: countGet }),
      };
      const where = jest.fn().mockReturnValue(countQuery);
      const collection = jest.fn().mockReturnValue({ where });
      const firebaseService = {
        getFirestore: jest.fn().mockReturnValue({ collection }),
      } as unknown as FirebaseService;

      const repository = new ReadingsRepository(firebaseService);
      const result = await repository.countByMeter('M-001');

      expect(where).toHaveBeenCalledWith('meter_id', '==', 'M-001');
      expect(result).toBe(42);
    });
  });

  describe('findByMeterPaginated', () => {
    it('retorna nextCursor no nulo cuando hay una página siguiente', async () => {
      const docs = [
        readingDoc({ timestamp: '2026-01-01T00:00:00.000Z' }),
        readingDoc({ timestamp: '2026-01-01T01:00:00.000Z' }),
        readingDoc({ timestamp: '2026-01-01T02:00:00.000Z' }), // extra: la página siguiente existe
      ];
      const query = createQueryMock(docs);
      const collection = jest.fn().mockReturnValue(query);
      const firebaseService = {
        getFirestore: jest.fn().mockReturnValue({ collection }),
      } as unknown as FirebaseService;

      const repository = new ReadingsRepository(firebaseService);
      const result = await repository.findByMeterPaginated(
        'M-001',
        '2026-01-01T00:00:00.000Z',
        '2026-01-02T00:00:00.000Z',
        2,
      );

      expect(query.where).toHaveBeenCalledWith(
        'timestamp',
        '>=',
        '2026-01-01T00:00:00.000Z',
      );
      expect(query.limit).toHaveBeenCalledWith(3);
      expect(result.data).toHaveLength(2);
      expect(result.nextCursor).toBe('2026-01-01T01:00:00.000Z');
    });

    it('retorna nextCursor null en la última página', async () => {
      const docs = [
        readingDoc({ timestamp: '2026-01-01T00:00:00.000Z' }),
        readingDoc({ timestamp: '2026-01-01T01:00:00.000Z' }),
      ];
      const query = createQueryMock(docs);
      const collection = jest.fn().mockReturnValue(query);
      const firebaseService = {
        getFirestore: jest.fn().mockReturnValue({ collection }),
      } as unknown as FirebaseService;

      const repository = new ReadingsRepository(firebaseService);
      const result = await repository.findByMeterPaginated(
        'M-001',
        '2026-01-01T00:00:00.000Z',
        '2026-01-02T00:00:00.000Z',
        2,
      );

      expect(result.data).toHaveLength(2);
      expect(result.nextCursor).toBeNull();
    });

    it('usa el cursor como límite inferior exclusivo cuando se pasa una página siguiente', async () => {
      const query = createQueryMock([
        readingDoc({ timestamp: '2026-01-01T02:00:00.000Z' }),
      ]);
      const collection = jest.fn().mockReturnValue(query);
      const firebaseService = {
        getFirestore: jest.fn().mockReturnValue({ collection }),
      } as unknown as FirebaseService;

      const repository = new ReadingsRepository(firebaseService);
      await repository.findByMeterPaginated(
        'M-001',
        '2026-01-01T00:00:00.000Z',
        '2026-01-02T00:00:00.000Z',
        2,
        '2026-01-01T01:00:00.000Z',
      );

      expect(query.where).toHaveBeenCalledWith(
        'timestamp',
        '>',
        '2026-01-01T01:00:00.000Z',
      );
    });
  });
});

import type { FirebaseService } from '../firebase/firebase.service';
import { ReadingsRepository } from './readings.repository';

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
});

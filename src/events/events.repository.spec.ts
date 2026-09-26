import type { FirebaseService } from '../firebase/firebase.service';
import { EventsRepository } from './events.repository';

function createQueryMock(docs: unknown[]) {
  const query = {
    where: jest.fn(),
    get: jest.fn().mockResolvedValue({ docs }),
  };
  query.where.mockReturnValue(query);
  return query;
}

function eventDoc(overrides: Partial<Record<string, unknown>>) {
  return {
    data: () => ({
      meter_id: 'M-001',
      event_timestamp: '2026-01-01T00:00:00.000Z',
      event_type: 'MAINTENANCE',
      description: 'desc',
      duration_hours: null,
      ...overrides,
    }),
  };
}

describe('EventsRepository', () => {
  it('queries by meter_id and merges results ordered by event_timestamp', async () => {
    const docs = [
      eventDoc({
        event_timestamp: '2026-01-02T00:00:00.000Z',
        event_type: 'MAINTENANCE',
      }),
      eventDoc({
        event_timestamp: '2026-01-01T00:00:00.000Z',
        event_type: 'OUTAGE',
      }),
    ];

    const query = createQueryMock(docs);
    const collection = jest.fn().mockReturnValue(query);
    const firebaseService = {
      getFirestore: jest.fn().mockReturnValue({ collection }),
    } as unknown as FirebaseService;

    const repository = new EventsRepository(firebaseService);
    const result = await repository.findByMeterAndRange(
      'M-001',
      '2026-01-01T00:00:00.000Z',
      '2026-01-03T00:00:00.000Z',
    );

    expect(collection).toHaveBeenCalledTimes(1);
    expect(query.where).toHaveBeenCalledWith('meter_id', '==', 'M-001');

    expect(result.map((event) => event.eventType)).toEqual([
      'OUTAGE',
      'MAINTENANCE',
    ]);
    expect(result[0].eventTimestamp <= result[1].eventTimestamp).toBe(true);
  });

  it('returns an empty array when the query has no matches', async () => {
    const query = createQueryMock([]);
    const collection = jest.fn().mockReturnValue(query);
    const firebaseService = {
      getFirestore: jest.fn().mockReturnValue({ collection }),
    } as unknown as FirebaseService;

    const repository = new EventsRepository(firebaseService);
    const result = await repository.findByMeterAndRange(
      'M-001',
      '2026-01-01T00:00:00.000Z',
      '2026-01-03T00:00:00.000Z',
    );

    expect(result).toEqual([]);
  });
});

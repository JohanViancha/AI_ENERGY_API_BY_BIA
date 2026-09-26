import {
  fromFirestoreDoc,
  getReadingDocId,
  Reading,
  ReadingFirestoreDoc,
  toFirestoreDoc,
} from './reading.entity';

describe('Reading mappers', () => {
  const reading: Reading = {
    meterId: 'M-001',
    timestamp: '2026-01-01T10:00:00.000Z',
    consumptionKwh: 12.5,
    voltage: 220,
    current: 5.2,
    powerFactor: 0.95,
    status: 'OK',
  };

  const doc: ReadingFirestoreDoc = {
    meter_id: 'M-001',
    timestamp: '2026-01-01T10:00:00.000Z',
    consumption_kwh: 12.5,
    voltage: 220,
    current: 5.2,
    power_factor: 0.95,
    status: 'OK',
  };

  it('converts a Reading to its Firestore doc shape (camelCase -> snake_case)', () => {
    expect(toFirestoreDoc(reading)).toEqual(doc);
  });

  it('converts a Firestore doc back to a Reading (snake_case -> camelCase)', () => {
    expect(fromFirestoreDoc(doc)).toEqual(reading);
  });
});

describe('getReadingDocId', () => {
  it('builds the doc id as `${meterId}_${unixTimestampSeconds}`', () => {
    expect(getReadingDocId('M-001', '2026-01-01T10:00:00.000Z')).toBe(
      'M-001_1767261600',
    );
  });

  it('produces the same id for the same meter and timestamp (idempotent)', () => {
    const id1 = getReadingDocId('M-002', '2026-03-15T08:00:00.000Z');
    const id2 = getReadingDocId('M-002', '2026-03-15T08:00:00.000Z');

    expect(id1).toBe(id2);
  });
});

import { createHash } from 'crypto';
import {
  fromFirestoreDoc,
  getEventDocId,
  OperationalEvent,
  OperationalEventFirestoreDoc,
  toFirestoreDoc,
} from './operational-event.entity';

describe('OperationalEvent mappers', () => {
  const event: OperationalEvent = {
    meterId: 'M-001',
    eventTimestamp: '2026-01-01T10:00:00.000Z',
    eventType: 'MAINTENANCE',
    description: 'Scheduled maintenance',
    durationHours: 4,
  };

  const doc: OperationalEventFirestoreDoc = {
    meter_id: 'M-001',
    event_timestamp: '2026-01-01T10:00:00.000Z',
    event_type: 'MAINTENANCE',
    description: 'Scheduled maintenance',
    duration_hours: 4,
  };

  it('converts an OperationalEvent to its Firestore doc shape (camelCase -> snake_case)', () => {
    expect(toFirestoreDoc(event)).toEqual(doc);
  });

  it('converts a Firestore doc back to an OperationalEvent (snake_case -> camelCase)', () => {
    expect(fromFirestoreDoc(doc)).toEqual(event);
  });

  it('preserves durationHours === null (event without a duration in the CSV)', () => {
    const withoutDuration: OperationalEvent = { ...event, durationHours: null };

    expect(toFirestoreDoc(withoutDuration).duration_hours).toBeNull();
    expect(
      fromFirestoreDoc({ ...doc, duration_hours: null }).durationHours,
    ).toBeNull();
  });
});

describe('getEventDocId', () => {
  it('builds the doc id as sha1(meterId|eventTimestamp|eventType).slice(0, 16)', () => {
    const expected = createHash('sha1')
      .update('M-001|2026-01-01T10:00:00.000Z|MAINTENANCE')
      .digest('hex')
      .slice(0, 16);

    expect(
      getEventDocId('M-001', '2026-01-01T10:00:00.000Z', 'MAINTENANCE'),
    ).toBe(expected);
    expect(
      getEventDocId('M-001', '2026-01-01T10:00:00.000Z', 'MAINTENANCE'),
    ).toHaveLength(16);
  });

  it('produces the same id for an event with an empty meterId', () => {
    const id1 = getEventDocId('', '2026-02-01T00:00:00.000Z', 'OUTAGE');
    const id2 = getEventDocId('', '2026-02-01T00:00:00.000Z', 'OUTAGE');

    expect(id1).toBe(id2);
  });
});

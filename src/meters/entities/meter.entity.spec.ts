import {
  fromFirestoreDoc,
  Meter,
  MeterFirestoreDoc,
  toFirestoreDoc,
} from './meter.entity';

describe('Meter mappers', () => {
  it('converts a Meter to its Firestore doc shape (camelCase -> snake_case)', () => {
    const meter: Meter = { meterId: 'M-001' };

    expect(toFirestoreDoc(meter)).toEqual<MeterFirestoreDoc>({
      meter_id: 'M-001',
    });
  });

  it('converts a Firestore doc back to a Meter (snake_case -> camelCase)', () => {
    const doc: MeterFirestoreDoc = { meter_id: 'M-001' };

    expect(fromFirestoreDoc(doc)).toEqual<Meter>({
      meterId: 'M-001',
    });
  });
});

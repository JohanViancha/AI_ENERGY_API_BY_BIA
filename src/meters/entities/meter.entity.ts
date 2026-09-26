export interface Meter {
  meterId: string; // también es el id del documento
}

export interface MeterFirestoreDoc {
  meter_id: string;
}

export function toFirestoreDoc(meter: Meter): MeterFirestoreDoc {
  return {
    meter_id: meter.meterId,
  };
}

export function fromFirestoreDoc(doc: MeterFirestoreDoc): Meter {
  return {
    meterId: doc.meter_id,
  };
}

export type ReadingStatus = 'OK' | 'ESTIMATED' | 'INVALID';

export interface Reading {
  meterId: string;
  timestamp: string; // ISO 8601, granularidad horaria
  consumptionKwh: number;
  voltage: number;
  current: number;
  powerFactor: number;
  status: ReadingStatus;
}

export interface ReadingFirestoreDoc {
  meter_id: string;
  timestamp: string;
  consumption_kwh: number;
  voltage: number;
  current: number;
  power_factor: number;
  status: ReadingStatus;
}

export function toFirestoreDoc(reading: Reading): ReadingFirestoreDoc {
  return {
    meter_id: reading.meterId,
    timestamp: reading.timestamp,
    consumption_kwh: reading.consumptionKwh,
    voltage: reading.voltage,
    current: reading.current,
    power_factor: reading.powerFactor,
    status: reading.status,
  };
}

export function fromFirestoreDoc(doc: ReadingFirestoreDoc): Reading {
  return {
    meterId: doc.meter_id,
    timestamp: doc.timestamp,
    consumptionKwh: doc.consumption_kwh,
    voltage: doc.voltage,
    current: doc.current,
    powerFactor: doc.power_factor,
    status: doc.status,
  };
}

// doc id: `${meterId}_${unixTimestampSeconds}`
export function getReadingDocId(meterId: string, timestamp: string): string {
  const unixTimestampSeconds = Math.floor(new Date(timestamp).getTime() / 1000);
  return `${meterId}_${unixTimestampSeconds}`;
}

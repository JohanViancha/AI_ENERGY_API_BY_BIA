import { createHash } from 'crypto';

export interface OperationalEvent {
  meterId: string;
  eventTimestamp: string; // ISO 8601
  eventType: string; // normalizado a mayúsculas
  description: string;
  durationHours: number | null; // null cuando el CSV no lo trae
}

export interface OperationalEventFirestoreDoc {
  meter_id: string;
  event_timestamp: string;
  event_type: string;
  description: string;
  duration_hours: number | null;
}

export function toFirestoreDoc(
  event: OperationalEvent,
): OperationalEventFirestoreDoc {
  return {
    meter_id: event.meterId,
    event_timestamp: event.eventTimestamp,
    event_type: event.eventType,
    description: event.description,
    duration_hours: event.durationHours,
  };
}

export function fromFirestoreDoc(
  doc: OperationalEventFirestoreDoc,
): OperationalEvent {
  return {
    meterId: doc.meter_id,
    eventTimestamp: doc.event_timestamp,
    eventType: doc.event_type,
    description: doc.description,
    durationHours: doc.duration_hours,
  };
}

// doc id: sha1(`${meterId}|${eventTimestamp}|${eventType}`).slice(0, 16)
export function getEventDocId(
  meterId: string,
  eventTimestamp: string,
  eventType: string,
): string {
  return createHash('sha1')
    .update(`${meterId}|${eventTimestamp}|${eventType}`)
    .digest('hex')
    .slice(0, 16);
}

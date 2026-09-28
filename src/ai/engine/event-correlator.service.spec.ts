import { OperationalEvent } from '../../events/entities/operational-event.entity';
import { EventCorrelatorService } from './event-correlator.service';
import { AnomalyCandidate } from './types';

function addHours(baseIso: string, hours: number): string {
  return new Date(
    new Date(baseIso).getTime() + hours * 60 * 60 * 1000,
  ).toISOString();
}

const WINDOW_START = '2026-01-01T00:00:00.000Z';
const WINDOW_END = addHours(WINDOW_START, 10); // tramo de 10 horas

function makeCandidate(
  overrides: Partial<AnomalyCandidate> = {},
): AnomalyCandidate {
  return {
    meterId: 'M-001',
    windowStart: WINDOW_START,
    windowEnd: WINDOW_END,
    readings: [],
    signals: [],
    baselineMedian: 50,
    observedMedian: 100,
    variationPct: 100,
    ...overrides,
  };
}

function makeEvent(
  overrides: Partial<OperationalEvent> = {},
): OperationalEvent {
  return {
    meterId: 'M-001',
    eventTimestamp: WINDOW_START,
    eventType: 'MAINTENANCE',
    description: 'evento de prueba',
    durationHours: 6,
    ...overrides,
  };
}

describe('EventCorrelatorService', () => {
  let service: EventCorrelatorService;

  beforeEach(() => {
    service = new EventCorrelatorService();
  });

  it('sin eventos: cobertura 0 y sin eventos correlacionados', () => {
    const result = service.correlate(makeCandidate(), []);
    expect(result.coveragePct).toBe(0);
    expect(result.matchedEvents).toHaveLength(0);
  });

  it('evento que cubre >90% de la ventana', () => {
    const event = makeEvent({
      eventTimestamp: addHours(WINDOW_START, -1),
      durationHours: 20,
    });
    const result = service.correlate(makeCandidate(), [event]);
    expect(result.coveragePct).toBe(100);
    expect(result.matchedEvents).toHaveLength(1);
  });

  it('evento que cubre entre 50% y 90% de la ventana (60%)', () => {
    const event = makeEvent({ eventTimestamp: WINDOW_START, durationHours: 6 });
    const result = service.correlate(makeCandidate(), [event]);
    expect(result.coveragePct).toBeCloseTo(60);
  });

  it('evento que cubre menos del 50% de la ventana (30%)', () => {
    const event = makeEvent({ eventTimestamp: WINDOW_START, durationHours: 3 });
    const result = service.correlate(makeCandidate(), [event]);
    expect(result.coveragePct).toBeCloseTo(30);
  });

  it('durationHours=null usa ventana por defecto de ±24h alrededor del evento', () => {
    const event = makeEvent({
      eventTimestamp: addHours(WINDOW_START, 5),
      durationHours: null,
    });
    const result = service.correlate(makeCandidate(), [event]);
    expect(result.coveragePct).toBe(100); // ±24h desde el punto medio cubre todo el tramo de 10h
  });

  it('excluye eventos UNKNOWN y DATA_QUALITY aunque cubran toda la ventana', () => {
    const unknownEvent = makeEvent({
      eventType: 'UNKNOWN',
      eventTimestamp: WINDOW_START,
      durationHours: 20,
    });
    const dataQualityEvent = makeEvent({
      eventType: 'DATA_QUALITY',
      eventTimestamp: WINDOW_START,
      durationHours: 20,
    });
    const result = service.correlate(makeCandidate(), [
      unknownEvent,
      dataQualityEvent,
    ]);
    expect(result.coveragePct).toBe(0);
    expect(result.matchedEvents).toHaveLength(0);
  });

  it('ignora eventos de otro medidor', () => {
    const event = makeEvent({
      meterId: 'M-002',
      eventTimestamp: WINDOW_START,
      durationHours: 20,
    });
    const result = service.correlate(makeCandidate({ meterId: 'M-001' }), [
      event,
    ]);
    expect(result.coveragePct).toBe(0);
  });

  it('une eventos solapados sin contar dos veces la cobertura compartida', () => {
    // evento1: 0h-6h, evento2: 3h-9h → unión = 0h-9h = 90% de la ventana de 10h
    const event1 = makeEvent({
      eventTimestamp: WINDOW_START,
      durationHours: 6,
    });
    const event2 = makeEvent({
      eventTimestamp: addHours(WINDOW_START, 3),
      durationHours: 6,
    });
    const result = service.correlate(makeCandidate(), [event1, event2]);
    expect(result.coveragePct).toBeCloseTo(90);
    expect(result.matchedEvents).toHaveLength(2);
  });

  it('un tramo de una sola lectura (windowStart === windowEnd) usa una ventana efectiva de 1 hora', () => {
    const singleReadingCandidate = makeCandidate({
      windowStart: WINDOW_START,
      windowEnd: WINDOW_START,
    });
    const event = makeEvent({ eventTimestamp: WINDOW_START, durationHours: 1 });
    const result = service.correlate(singleReadingCandidate, [event]);
    expect(result.coveragePct).toBe(100);
  });
});

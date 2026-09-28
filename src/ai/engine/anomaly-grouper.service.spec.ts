import { Reading } from '../../readings/entities/reading.entity';
import {
  AnomalousReadingInput,
  AnomalyGrouperService,
} from './anomaly-grouper.service';
import { DetectionSignal } from './types';

function makeReading(
  meterId: string,
  isoTimestamp: string,
  consumptionKwh: number,
): Reading {
  return {
    meterId,
    timestamp: isoTimestamp,
    consumptionKwh,
    voltage: 220,
    current: 10,
    powerFactor: 0.95,
    status: 'OK',
  };
}

function addHours(baseIso: string, hours: number): string {
  return new Date(
    new Date(baseIso).getTime() + hours * 60 * 60 * 1000,
  ).toISOString();
}

const zScoreSignal = (value: number): DetectionSignal => ({
  detector: 'Z_SCORE',
  value,
});

function anomalousInput(
  meterId: string,
  isoTimestamp: string,
  consumptionKwh: number,
  signals: DetectionSignal[],
  baselineMedian = 50,
): AnomalousReadingInput {
  return {
    reading: makeReading(meterId, isoTimestamp, consumptionKwh),
    signals,
    baselineMedian,
  };
}

describe('AnomalyGrouperService', () => {
  let service: AnomalyGrouperService;

  beforeEach(() => {
    service = new AnomalyGrouperService();
  });

  it('M-109: agrupa 58 horas contiguas anómalas en un único candidato', () => {
    const base = '2026-01-01T00:00:00.000Z';
    const inputs: AnomalousReadingInput[] = Array.from({ length: 58 }, (_, i) =>
      anomalousInput('M-109', addHours(base, i), 110, [zScoreSignal(5)]),
    );

    const candidates = service.group(inputs);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].meterId).toBe('M-109');
    expect(candidates[0].readings).toHaveLength(58);
    expect(candidates[0].windowStart).toBe(base);
    expect(candidates[0].windowEnd).toBe(addHours(base, 57));
  });

  it('M-112: lecturas cada 3h en 2 días se agrupan en un único candidato con gapHours=4 (default)', () => {
    const base = '2026-01-01T00:00:00.000Z';
    const hours = Array.from({ length: 17 }, (_, i) => i * 3); // 0,3,...,48 → 2 días
    const inputs: AnomalousReadingInput[] = hours.map((h) =>
      anomalousInput('M-112', addHours(base, h), 90, [zScoreSignal(4)]),
    );

    const candidates = service.group(inputs);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].meterId).toBe('M-112');
    expect(candidates[0].readings).toHaveLength(17);
  });

  it('separa en dos candidatos cuando el gap es exactamente gapHours (no continúa el tramo)', () => {
    const base = '2026-01-01T00:00:00.000Z';
    const inputs: AnomalousReadingInput[] = [
      anomalousInput('M-001', base, 100, [zScoreSignal(5)]),
      anomalousInput('M-001', addHours(base, 4), 100, [zScoreSignal(5)]),
    ];

    const candidates = service.group(inputs, 4);

    expect(candidates).toHaveLength(2);
  });

  it('mantiene el mismo tramo cuando el gap está justo debajo de gapHours', () => {
    const base = '2026-01-01T00:00:00.000Z';
    const inputs: AnomalousReadingInput[] = [
      anomalousInput('M-001', base, 100, [zScoreSignal(5)]),
      anomalousInput('M-001', addHours(base, 3.99), 100, [zScoreSignal(5)]),
    ];

    const candidates = service.group(inputs, 4);

    expect(candidates).toHaveLength(1);
  });

  it('ignora lecturas sin señales y no las incluye en ningún candidato', () => {
    const base = '2026-01-01T00:00:00.000Z';
    const inputs: AnomalousReadingInput[] = [
      anomalousInput('M-001', base, 100, [zScoreSignal(5)]),
      anomalousInput('M-001', addHours(base, 1), 50, []), // lectura normal, sin señales
      anomalousInput('M-001', addHours(base, 2), 100, [zScoreSignal(5)]),
    ];

    const candidates = service.group(inputs, 4);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].readings).toHaveLength(2);
  });

  it('agrupa medidores distintos en candidatos separados aunque coincidan en el tiempo', () => {
    const base = '2026-01-01T00:00:00.000Z';
    const inputs: AnomalousReadingInput[] = [
      anomalousInput('M-001', base, 100, [zScoreSignal(5)]),
      anomalousInput('M-002', base, 100, [zScoreSignal(5)]),
    ];

    const candidates = service.group(inputs, 4);

    expect(candidates).toHaveLength(2);
    expect(candidates.map((c) => c.meterId).sort()).toEqual(['M-001', 'M-002']);
  });

  it('fusiona señales por detector conservando el valor de mayor magnitud absoluta', () => {
    const base = '2026-01-01T00:00:00.000Z';
    const inputs: AnomalousReadingInput[] = [
      anomalousInput('M-001', base, 100, [zScoreSignal(2)]),
      anomalousInput('M-001', addHours(base, 1), 100, [
        zScoreSignal(5),
        { detector: 'IQR_OUTLIER', value: 10 },
      ]),
    ];

    const candidates = service.group(inputs, 4);

    expect(candidates[0].signals).toEqual(
      expect.arrayContaining([
        { detector: 'Z_SCORE', value: 5 },
        { detector: 'IQR_OUTLIER', value: 10 },
      ]),
    );
    expect(candidates[0].signals).toHaveLength(2);
  });

  it('calcula baselineMedian (promedio), observedMedian (mediana) y variationPct correctamente', () => {
    const base = '2026-01-01T00:00:00.000Z';
    const inputs: AnomalousReadingInput[] = [
      anomalousInput('M-001', base, 10, [zScoreSignal(5)], 40),
      anomalousInput('M-001', addHours(base, 1), 20, [zScoreSignal(5)], 60),
      anomalousInput('M-001', addHours(base, 2), 30, [zScoreSignal(5)], 50),
    ];

    const candidates = service.group(inputs, 4);

    expect(candidates[0].observedMedian).toBe(20); // mediana(10,20,30)
    expect(candidates[0].baselineMedian).toBe(50); // promedio(40,60,50)
    expect(candidates[0].variationPct).toBeCloseTo(((20 - 50) / 50) * 100);
  });

  it('devuelve variationPct=0 cuando baselineMedian y observedMedian son ambos cero', () => {
    const base = '2026-01-01T00:00:00.000Z';
    const inputs: AnomalousReadingInput[] = [
      anomalousInput('M-001', base, 0, [zScoreSignal(5)], 0),
    ];

    const candidates = service.group(inputs, 4);

    expect(candidates[0].variationPct).toBe(0);
  });

  it('devuelve un array vacío cuando ninguna lectura tiene señales', () => {
    const base = '2026-01-01T00:00:00.000Z';
    const inputs: AnomalousReadingInput[] = [
      anomalousInput('M-001', base, 50, []),
    ];

    const candidates = service.group(inputs, 4);

    expect(candidates).toHaveLength(0);
  });
});

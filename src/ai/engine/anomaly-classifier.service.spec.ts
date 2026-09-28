import { AnomalyClassifierService } from './anomaly-classifier.service';
import { AnomalyCandidate } from './types';

function makeCandidate(
  overrides: Partial<AnomalyCandidate> = {},
): AnomalyCandidate {
  return {
    meterId: 'M-001',
    windowStart: '2026-01-01T00:00:00.000Z',
    windowEnd: '2026-01-01T05:00:00.000Z',
    readings: [],
    signals: [{ detector: 'Z_SCORE', value: 5 }],
    baselineMedian: 50,
    observedMedian: 100,
    variationPct: 100,
    ...overrides,
  };
}

describe('AnomalyClassifierService', () => {
  let service: AnomalyClassifierService;

  beforeEach(() => {
    service = new AnomalyClassifierService();
  });

  it('rama 1: DATA_QUALITY dispara sin importar cobertura ni variación', () => {
    const candidate = makeCandidate({
      signals: [{ detector: 'DATA_QUALITY', value: 1 }],
      variationPct: 5, // bajo, no debería activar HIGH por variación
    });
    const result = service.classify(candidate, 100); // cobertura alta tampoco importa
    expect(result).toEqual({ type: 'DATA_QUALITY', severity: 'HIGH' });
  });

  it('rama 2a: cobertura > 90% → FALSE_POSITIVE / LOW', () => {
    const result = service.classify(makeCandidate(), 90.1);
    expect(result).toEqual({ type: 'FALSE_POSITIVE', severity: 'LOW' });
  });

  it('rama 2b: cobertura exactamente 90% → EXPLAINABLE_ANOMALY / MEDIUM (no es > 90)', () => {
    const result = service.classify(makeCandidate(), 90);
    expect(result).toEqual({ type: 'EXPLAINABLE_ANOMALY', severity: 'MEDIUM' });
  });

  it('rama 2c: cobertura entre 50-90% (60%) → EXPLAINABLE_ANOMALY / MEDIUM', () => {
    const result = service.classify(makeCandidate(), 60);
    expect(result).toEqual({ type: 'EXPLAINABLE_ANOMALY', severity: 'MEDIUM' });
  });

  it('rama 2d: cobertura < 50% (30%) → EXPLAINABLE_ANOMALY / MEDIUM', () => {
    const result = service.classify(makeCandidate(), 30);
    expect(result).toEqual({ type: 'EXPLAINABLE_ANOMALY', severity: 'MEDIUM' });
  });

  it('rama 3a: sin evento (cobertura 0), variación > 100% → REAL_ANOMALY / HIGH', () => {
    const result = service.classify(makeCandidate({ variationPct: 150 }), 0);
    expect(result).toEqual({ type: 'REAL_ANOMALY', severity: 'HIGH' });
  });

  it('rama 3b: sin evento, variación exactamente 100% → REAL_ANOMALY / MEDIUM (no es > 100)', () => {
    const result = service.classify(makeCandidate({ variationPct: 100 }), 0);
    expect(result).toEqual({ type: 'REAL_ANOMALY', severity: 'MEDIUM' });
  });

  it('rama 3c: sin evento, variación exactamente 30% → REAL_ANOMALY / MEDIUM (límite inferior inclusive)', () => {
    const result = service.classify(makeCandidate({ variationPct: 30 }), 0);
    expect(result).toEqual({ type: 'REAL_ANOMALY', severity: 'MEDIUM' });
  });

  it('rama 3d: sin evento, variación < 30% (10%) → REAL_ANOMALY / LOW', () => {
    const result = service.classify(makeCandidate({ variationPct: 10 }), 0);
    expect(result).toEqual({ type: 'REAL_ANOMALY', severity: 'LOW' });
  });

  it('rama 3e: variación negativa grande (-150%) → REAL_ANOMALY / HIGH (usa valor absoluto)', () => {
    const result = service.classify(makeCandidate({ variationPct: -150 }), 0);
    expect(result).toEqual({ type: 'REAL_ANOMALY', severity: 'HIGH' });
  });

  it('rama 3f: variación negativa pequeña (-10%) → REAL_ANOMALY / LOW', () => {
    const result = service.classify(makeCandidate({ variationPct: -10 }), 0);
    expect(result).toEqual({ type: 'REAL_ANOMALY', severity: 'LOW' });
  });
});

import { ConfidenceCalculatorService } from './confidence-calculator.service';
import { AnomalyCandidate, DetectionSignal } from './types';

function makeCandidate(
  overrides: Partial<AnomalyCandidate> = {},
): AnomalyCandidate {
  return {
    meterId: 'M-001',
    windowStart: '2026-01-01T00:00:00.000Z',
    windowEnd: '2026-01-01T05:00:00.000Z',
    readings: [],
    signals: [],
    baselineMedian: 50,
    observedMedian: 100,
    variationPct: 0,
    ...overrides,
  };
}

describe('ConfidenceCalculatorService', () => {
  let service: ConfidenceCalculatorService;

  beforeEach(() => {
    service = new ConfidenceCalculatorService();
  });

  it('alcanza el máximo (0.99) cuando los tres componentes están saturados en 1', () => {
    const signals: DetectionSignal[] = [
      { detector: 'Z_SCORE', value: 6 },
      { detector: 'IQR_OUTLIER', value: 20 },
      { detector: 'ELECTRICAL_RELATION', value: 0.5 },
    ];
    const candidate = makeCandidate({ signals, variationPct: 150 });

    const confidence = service.calculate({
      candidate,
      eventCoveragePct: 95, // > 90 → claridad_evento = 1.00
      isFallbackByReading: [],
    });

    // señales=min(1,3/3)=1, magnitud=min(1,max(6/6,150/150))=1, claridad=1.00
    // 0.40 + 0.20*1 + 0.20*1 + 0.20*1 = 1.00 → cap en 0.99
    expect(confidence).toBeCloseTo(0.99);
  });

  it('calcula el valor exacto con un solo detector no-Z_SCORE, sin variación y sin evento', () => {
    const candidate = makeCandidate({
      signals: [{ detector: 'IQR_OUTLIER', value: 5 }],
      variationPct: 0,
    });

    const confidence = service.calculate({
      candidate,
      eventCoveragePct: 0, // sin evento → claridad_evento = 0.85
      isFallbackByReading: [],
    });

    // señales=min(1,1/3)=1/3, magnitud=max(0/6, 0/150)=0, claridad=0.85
    // 0.40 + 0.20*(1/3) + 0.20*0 + 0.20*0.85
    const expected = 0.4 + 0.2 * (1 / 3) + 0.2 * 0 + 0.2 * 0.85;
    expect(confidence).toBeCloseTo(expected);
  });

  describe('claridad_evento según cobertura', () => {
    const neutralCandidate = makeCandidate({ signals: [], variationPct: 0 });

    it('sin evento (cobertura 0) → 0.85', () => {
      const confidence = service.calculate({
        candidate: neutralCandidate,
        eventCoveragePct: 0,
        isFallbackByReading: [],
      });
      expect(confidence).toBeCloseTo(0.4 + 0.2 * 0.85);
    });

    it('cobertura > 90% → 1.00', () => {
      const confidence = service.calculate({
        candidate: neutralCandidate,
        eventCoveragePct: 95,
        isFallbackByReading: [],
      });
      expect(confidence).toBeCloseTo(0.4 + 0.2 * 1.0);
    });

    it('cobertura exactamente 90% → 0.70 (no es > 90)', () => {
      const confidence = service.calculate({
        candidate: neutralCandidate,
        eventCoveragePct: 90,
        isFallbackByReading: [],
      });
      expect(confidence).toBeCloseTo(0.4 + 0.2 * 0.7);
    });

    it('cobertura exactamente 50% → 0.70 (límite inferior inclusive)', () => {
      const confidence = service.calculate({
        candidate: neutralCandidate,
        eventCoveragePct: 50,
        isFallbackByReading: [],
      });
      expect(confidence).toBeCloseTo(0.4 + 0.2 * 0.7);
    });

    it('cobertura < 50% (30%) → 0.40', () => {
      const confidence = service.calculate({
        candidate: neutralCandidate,
        eventCoveragePct: 30,
        isFallbackByReading: [],
      });
      expect(confidence).toBeCloseTo(0.4 + 0.2 * 0.4);
    });
  });

  it('magnitud toma el máximo entre el componente de z-score y el de variación (no el promedio)', () => {
    const candidate = makeCandidate({
      signals: [{ detector: 'Z_SCORE', value: 1 }], // 1/6 ≈ 0.1667
      variationPct: 75, // 75/150 = 0.5
    });

    const confidence = service.calculate({
      candidate,
      eventCoveragePct: 0,
      isFallbackByReading: [],
    });

    const señales = 1 / 3;
    const magnitud = 0.5; // max(0.1667, 0.5)
    const expected = 0.4 + 0.2 * señales + 0.2 * magnitud + 0.2 * 0.85;
    expect(confidence).toBeCloseTo(expected);
  });

  describe('penalización por baseline de fallback', () => {
    it('aplica ×0.5 cuando la mayoría de lecturas del tramo usaron fallback', () => {
      const candidate = makeCandidate({ signals: [], variationPct: 0 });
      const withoutPenalty = service.calculate({
        candidate,
        eventCoveragePct: 0,
        isFallbackByReading: [],
      });

      const withPenalty = service.calculate({
        candidate,
        eventCoveragePct: 0,
        isFallbackByReading: [true, true, false],
      });

      expect(withPenalty).toBeCloseTo(withoutPenalty * 0.5);
    });

    it('no aplica penalización con exactamente 50% de fallback (no es mayoría)', () => {
      const candidate = makeCandidate({ signals: [], variationPct: 0 });
      const confidence = service.calculate({
        candidate,
        eventCoveragePct: 0,
        isFallbackByReading: [true, false],
      });

      expect(confidence).toBeCloseTo(0.4 + 0.2 * 0.85);
    });

    it('no aplica penalización cuando no hay lecturas de fallback', () => {
      const candidate = makeCandidate({ signals: [], variationPct: 0 });
      const confidence = service.calculate({
        candidate,
        eventCoveragePct: 0,
        isFallbackByReading: [false, false, false],
      });

      expect(confidence).toBeCloseTo(0.4 + 0.2 * 0.85);
    });
  });
});

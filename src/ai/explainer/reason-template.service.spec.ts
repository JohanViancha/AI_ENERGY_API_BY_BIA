import { ReasonTemplateService } from './reason-template.service';

describe('ReasonTemplateService', () => {
  let service: ReasonTemplateService;

  beforeEach(() => {
    service = new ReasonTemplateService();
  });

  it('incluye type, meterId, windowStart, windowEnd, variationPct y las señales', () => {
    const reason = service.generate({
      type: 'REAL_ANOMALY',
      meterId: 'M-109',
      windowStart: '2026-01-01T00:00:00.000Z',
      windowEnd: '2026-01-03T10:00:00.000Z',
      variationPct: 123.456,
      signals: ['Z_SCORE', 'NO_EVENT'],
    });

    expect(reason).toContain('REAL_ANOMALY');
    expect(reason).toContain('M-109');
    expect(reason).toContain('2026-01-01T00:00:00.000Z');
    expect(reason).toContain('2026-01-03T10:00:00.000Z');
    expect(reason).toContain('123.5%'); // redondeado a 1 decimal
    expect(reason).toContain('Z_SCORE, NO_EVENT');
  });

  it('redondea variationPct negativo a 1 decimal', () => {
    const reason = service.generate({
      type: 'DATA_QUALITY',
      meterId: 'M-112',
      windowStart: '2026-01-01T00:00:00.000Z',
      windowEnd: '2026-01-01T05:00:00.000Z',
      variationPct: -87.6666,
      signals: ['DATA_QUALITY'],
    });

    expect(reason).toContain('-87.7%');
  });

  it('une múltiples señales con coma', () => {
    const reason = service.generate({
      type: 'EXPLAINABLE_ANOMALY',
      meterId: 'M-001',
      windowStart: '2026-01-01T00:00:00.000Z',
      windowEnd: '2026-01-01T05:00:00.000Z',
      variationPct: 60,
      signals: ['IQR_OUTLIER', 'HOURLY_PATTERN', 'EVENT_MATCH'],
    });

    expect(reason).toContain('IQR_OUTLIER, HOURLY_PATTERN, EVENT_MATCH');
  });
});

import {
  AnomalySeverity,
  AnomalyType,
} from '../../anomalies/entities/anomaly.entity';
import { RecommendationTemplateService } from './recommendation-template.service';

describe('RecommendationTemplateService', () => {
  let service: RecommendationTemplateService;

  beforeEach(() => {
    service = new RecommendationTemplateService();
  });

  const cases: Array<{ type: AnomalyType; severity: AnomalySeverity }> = [
    { type: 'DATA_QUALITY', severity: 'HIGH' },
    { type: 'REAL_ANOMALY', severity: 'HIGH' },
    { type: 'REAL_ANOMALY', severity: 'MEDIUM' },
    { type: 'REAL_ANOMALY', severity: 'LOW' },
    { type: 'EXPLAINABLE_ANOMALY', severity: 'MEDIUM' },
    { type: 'FALSE_POSITIVE', severity: 'LOW' },
  ];

  it.each(cases)(
    'genera una recomendación distinta para $type/$severity que incluye el meterId',
    ({ type, severity }) => {
      const recommendation = service.generate({
        type,
        severity,
        meterId: 'M-109',
      });

      expect(recommendation).toContain('M-109');
      expect(recommendation.length).toBeGreaterThan(0);
    },
  );

  it('produce textos distintos para cada combinación type×severity', () => {
    const texts = cases.map((c) =>
      service.generate({ ...c, meterId: 'M-001' }),
    );
    const uniqueTexts = new Set(texts);
    expect(uniqueTexts.size).toBe(cases.length);
  });

  it('lanza un error para una combinación type×severity no soportada', () => {
    expect(() =>
      service.generate({
        type: 'DATA_QUALITY',
        severity: 'LOW',
        meterId: 'M-001',
      }),
    ).toThrow();
  });
});

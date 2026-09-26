import {
  Anomaly,
  AnomalyFirestoreDoc,
  fromFirestoreDoc,
  toFirestoreDoc,
} from './anomaly.entity';

describe('Anomaly mappers', () => {
  const anomaly: Anomaly = {
    id: 'anomaly-123',
    meterId: 'M-001',
    analysisId: 'analysis-123',
    detectedAt: '2026-01-01T10:00:00.000Z',
    type: 'REAL_ANOMALY',
    severity: 'HIGH',
    confidence: 0.87,
    priorityScore: 2.61,
    status: 'OPEN',
    reason: null,
    recommendedAction: null,
    evidence: {
      baselineKwh: 100,
      observedKwh: 250,
      variationPct: 150,
      signals: ['SPIKE', 'QUALITY'],
      windowStart: '2026-01-01T00:00:00.000Z',
      windowEnd: '2026-01-02T00:00:00.000Z',
      relatedEvents: ['event-abc'],
      detectorScores: { SPIKE: 3.2, OUTLIER: 1.1 },
    },
  };

  const doc: AnomalyFirestoreDoc = {
    meter_id: 'M-001',
    analysis_id: 'analysis-123',
    detected_at: '2026-01-01T10:00:00.000Z',
    type: 'REAL_ANOMALY',
    severity: 'HIGH',
    confidence: 0.87,
    priority_score: 2.61,
    status: 'OPEN',
    reason: null,
    recommended_action: null,
    evidence: {
      baseline_kwh: 100,
      observed_kwh: 250,
      variation_pct: 150,
      signals: ['SPIKE', 'QUALITY'],
      window_start: '2026-01-01T00:00:00.000Z',
      window_end: '2026-01-02T00:00:00.000Z',
      related_events: ['event-abc'],
      detector_scores: { SPIKE: 3.2, OUTLIER: 1.1 },
    },
  };

  it('converts an Anomaly to its Firestore doc shape (camelCase -> snake_case, id excluded)', () => {
    expect(toFirestoreDoc(anomaly)).toEqual(doc);
  });

  it('converts a Firestore doc back to an Anomaly using the id passed separately', () => {
    expect(fromFirestoreDoc('anomaly-123', doc)).toEqual(anomaly);
  });
});

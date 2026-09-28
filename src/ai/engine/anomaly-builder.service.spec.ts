import { RecommendationTemplateService } from '../explainer/recommendation-template.service';
import { AnomalyBuilderService } from './anomaly-builder.service';
import { ClassificationResult } from './anomaly-classifier.service';
import { ConfidenceCalculatorService } from './confidence-calculator.service';
import { EventCorrelationResult } from './event-correlator.service';
import { AnomalyCandidate, HourlyBaseline } from './types';
import { Reading } from '../../readings/entities/reading.entity';

function makeReading(timestamp: string): Reading {
  return {
    meterId: 'M-001',
    timestamp,
    consumptionKwh: 100,
    voltage: 220,
    current: 10,
    powerFactor: 0.95,
    status: 'OK',
  };
}

function makeCandidate(): AnomalyCandidate {
  return {
    meterId: 'M-001',
    windowStart: '2026-01-01T05:00:00.000Z',
    windowEnd: '2026-01-01T05:00:00.000Z',
    readings: [makeReading('2026-01-01T05:00:00.000Z')],
    signals: [{ detector: 'Z_SCORE', value: 5 }],
    baselineMedian: 50,
    observedMedian: 100,
    variationPct: 100,
  };
}

function flatBaseline(isFallback: boolean): HourlyBaseline[] {
  return Array.from({ length: 24 }, () => ({
    median: 50,
    mad: 1,
    sampleCount: 10,
    isFallback,
  }));
}

describe('AnomalyBuilderService', () => {
  it('arma el Anomaly con confidence, priorityScore, recommendedAction y evidence', () => {
    const calculate = jest.fn().mockReturnValue(0.6);
    const confidenceCalculator = {
      calculate,
      computeMagnitude: jest.fn().mockReturnValue(0.3),
      computeEventClarity: jest.fn().mockReturnValue(0.85),
    } as unknown as ConfidenceCalculatorService;
    const recommendationTemplate = {
      generate: jest.fn().mockReturnValue('acción recomendada'),
    } as unknown as RecommendationTemplateService;

    const builder = new AnomalyBuilderService(
      confidenceCalculator,
      recommendationTemplate,
    );

    const candidate = makeCandidate();
    const classification: ClassificationResult = {
      type: 'REAL_ANOMALY',
      severity: 'HIGH',
    };
    const correlation: EventCorrelationResult = {
      coveragePct: 0,
      matchedEvents: [
        {
          meterId: 'M-001',
          eventTimestamp: '2026-01-01T00:00:00.000Z',
          eventType: 'MAINTENANCE',
          description: 'mantenimiento',
          durationHours: 2,
        },
      ],
    };
    const baselines = new Map([['M-001', flatBaseline(false)]]);

    const anomaly = builder.build({
      analysisId: 'analysis-1',
      candidate,
      classification,
      correlation,
      reason: 'texto de razón',
      baselines,
    });

    expect(anomaly.meterId).toBe('M-001');
    expect(anomaly.analysisId).toBe('analysis-1');
    expect(anomaly.type).toBe('REAL_ANOMALY');
    expect(anomaly.severity).toBe('HIGH');
    expect(anomaly.confidence).toBe(0.6);
    expect(anomaly.priorityScore).toBeCloseTo(3 * 0.6); // severityWeight(HIGH)=3
    expect(anomaly.status).toBe('OPEN');
    expect(anomaly.reason).toBe('texto de razón');
    expect(anomaly.recommendedAction).toBe('acción recomendada');
    expect(anomaly.evidence.baselineKwh).toBe(50);
    expect(anomaly.evidence.observedKwh).toBe(100);
    expect(anomaly.evidence.signals).toEqual(['Z_SCORE', 'EVENT_MATCH']);
    expect(anomaly.evidence.relatedEvents).toHaveLength(1);
    expect(anomaly.evidence.detectorScores).toEqual({
      Z_SCORE: 5,
      IQR_RESIDUAL: 0,
      VARIATION_PCT: 100,
      MAGNITUDE: 0.3,
      EVENT_CLARITY: 0.85,
      SIGNALS_COUNT: 1,
    });

    expect(calculate).toHaveBeenCalledWith({
      candidate,
      eventCoveragePct: 0,
      isFallbackByReading: [false],
    });
  });

  it('marca NO_EVENT en evidence.signals cuando no hay eventos correlacionados', () => {
    const confidenceCalculator = {
      calculate: jest.fn().mockReturnValue(0.5),
      computeMagnitude: jest.fn().mockReturnValue(0.2),
      computeEventClarity: jest.fn().mockReturnValue(0.85),
    } as unknown as ConfidenceCalculatorService;
    const recommendationTemplate = {
      generate: jest.fn().mockReturnValue('acción'),
    } as unknown as RecommendationTemplateService;
    const builder = new AnomalyBuilderService(
      confidenceCalculator,
      recommendationTemplate,
    );

    const anomaly = builder.build({
      analysisId: 'analysis-1',
      candidate: makeCandidate(),
      classification: { type: 'REAL_ANOMALY', severity: 'LOW' },
      correlation: { coveragePct: 0, matchedEvents: [] },
      reason: 'r',
      baselines: new Map([['M-001', flatBaseline(false)]]),
    });

    expect(anomaly.evidence.signals).toEqual(['Z_SCORE', 'NO_EVENT']);
    expect(anomaly.evidence.relatedEvents).toEqual([]);
  });
});

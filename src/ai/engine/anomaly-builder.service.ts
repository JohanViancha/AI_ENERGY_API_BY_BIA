import { Injectable } from '@nestjs/common';
import { Anomaly } from '../../anomalies/entities/anomaly.entity';
import { getEventDocId } from '../../events/entities/operational-event.entity';
import { RecommendationTemplateService } from '../explainer/recommendation-template.service';
import {
  ClassificationResult,
  severityWeight,
} from './anomaly-classifier.service';
import {
  buildDetectorScores,
  buildEvidenceSignals,
} from './anomaly-evidence-builder';
import { ConfidenceCalculatorService } from './confidence-calculator.service';
import { getHourOfDay } from './date-utils';
import { EventCorrelationResult } from './event-correlator.service';
import { AnomalyCandidate, HourlyBaseline } from './types';

export interface BuildAnomalyInput {
  analysisId: string;
  candidate: AnomalyCandidate;
  classification: ClassificationResult;
  correlation: EventCorrelationResult;
  reason: string;
  baselines: Map<string, HourlyBaseline[]>;
}

@Injectable()
export class AnomalyBuilderService {
  constructor(
    private readonly confidenceCalculator: ConfidenceCalculatorService,
    private readonly recommendationTemplate: RecommendationTemplateService,
  ) {}

  build(input: BuildAnomalyInput): Omit<Anomaly, 'id'> {
    const {
      analysisId,
      candidate,
      classification,
      correlation,
      reason,
      baselines,
    } = input;
    const meterBaseline = baselines.get(candidate.meterId) ?? [];

    const isFallbackByReading = candidate.readings.map(
      (reading) =>
        meterBaseline[getHourOfDay(reading.timestamp)]?.isFallback ?? false,
    );

    const confidence = this.confidenceCalculator.calculate({
      candidate,
      eventCoveragePct: correlation.coveragePct,
      isFallbackByReading,
    });

    const magnitude = this.confidenceCalculator.computeMagnitude(candidate);
    const eventClarity = this.confidenceCalculator.computeEventClarity(
      correlation.coveragePct,
    );
    const hasEventMatch = correlation.matchedEvents.length > 0;

    return {
      meterId: candidate.meterId,
      analysisId,
      detectedAt: new Date().toISOString(),
      type: classification.type,
      severity: classification.severity,
      confidence,
      priorityScore: severityWeight(classification.severity) * confidence,
      status: 'OPEN',
      reason,
      recommendedAction: this.recommendationTemplate.generate({
        type: classification.type,
        severity: classification.severity,
        meterId: candidate.meterId,
      }),
      evidence: {
        baselineKwh: candidate.baselineMedian,
        observedKwh: candidate.observedMedian,
        variationPct: candidate.variationPct,
        signals: buildEvidenceSignals(candidate, hasEventMatch),
        windowStart: candidate.windowStart,
        windowEnd: candidate.windowEnd,
        relatedEvents: correlation.matchedEvents.map((event) =>
          getEventDocId(event.meterId, event.eventTimestamp, event.eventType),
        ),
        detectorScores: buildDetectorScores(candidate, magnitude, eventClarity),
      },
    };
  }
}

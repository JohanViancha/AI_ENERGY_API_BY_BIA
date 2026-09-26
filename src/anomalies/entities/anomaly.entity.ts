export type AnomalyType =
  'REAL_ANOMALY' | 'EXPLAINABLE_ANOMALY' | 'FALSE_POSITIVE' | 'DATA_QUALITY';
export type AnomalySeverity = 'LOW' | 'MEDIUM' | 'HIGH';
export type AnomalyStatus = 'OPEN' | 'REVIEWED' | 'RESOLVED';

export interface AnomalyEvidence {
  baselineKwh: number;
  observedKwh: number;
  variationPct: number;
  signals: string[]; // detectores que dispararon, p. ej. ['SPIKE', 'QUALITY']
  windowStart: string;
  windowEnd: string;
  relatedEvents: string[]; // ids de documentos en `events`
  detectorScores: Record<string, number>; // p. ej. { SPIKE: 3.2, OUTLIER: 1.1 }
}

export interface Anomaly {
  id: string; // id autogenerado por Firestore
  meterId: string;
  analysisId: string;
  detectedAt: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  confidence: number; // 0.0 - 1.0
  priorityScore: number;
  status: AnomalyStatus; // default 'OPEN'
  reason: string | null;
  recommendedAction: string | null;
  evidence: AnomalyEvidence;
}

export interface AnomalyEvidenceFirestoreDoc {
  baseline_kwh: number;
  observed_kwh: number;
  variation_pct: number;
  signals: string[];
  window_start: string;
  window_end: string;
  related_events: string[];
  detector_scores: Record<string, number>;
}

export interface AnomalyFirestoreDoc {
  meter_id: string;
  analysis_id: string;
  detected_at: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  confidence: number;
  priority_score: number;
  status: AnomalyStatus;
  reason: string | null;
  recommended_action: string | null;
  evidence: AnomalyEvidenceFirestoreDoc;
}

export function toFirestoreDoc(anomaly: Anomaly): AnomalyFirestoreDoc {
  return {
    meter_id: anomaly.meterId,
    analysis_id: anomaly.analysisId,
    detected_at: anomaly.detectedAt,
    type: anomaly.type,
    severity: anomaly.severity,
    confidence: anomaly.confidence,
    priority_score: anomaly.priorityScore,
    status: anomaly.status,
    reason: anomaly.reason,
    recommended_action: anomaly.recommendedAction,
    evidence: {
      baseline_kwh: anomaly.evidence.baselineKwh,
      observed_kwh: anomaly.evidence.observedKwh,
      variation_pct: anomaly.evidence.variationPct,
      signals: anomaly.evidence.signals,
      window_start: anomaly.evidence.windowStart,
      window_end: anomaly.evidence.windowEnd,
      related_events: anomaly.evidence.relatedEvents,
      detector_scores: anomaly.evidence.detectorScores,
    },
  };
}

// `id` no vive dentro del documento: lo asigna Firestore, se pasa aparte.
export function fromFirestoreDoc(
  id: string,
  doc: AnomalyFirestoreDoc,
): Anomaly {
  return {
    id,
    meterId: doc.meter_id,
    analysisId: doc.analysis_id,
    detectedAt: doc.detected_at,
    type: doc.type,
    severity: doc.severity,
    confidence: doc.confidence,
    priorityScore: doc.priority_score,
    status: doc.status,
    reason: doc.reason,
    recommendedAction: doc.recommended_action,
    evidence: {
      baselineKwh: doc.evidence.baseline_kwh,
      observedKwh: doc.evidence.observed_kwh,
      variationPct: doc.evidence.variation_pct,
      signals: doc.evidence.signals,
      windowStart: doc.evidence.window_start,
      windowEnd: doc.evidence.window_end,
      relatedEvents: doc.evidence.related_events,
      detectorScores: doc.evidence.detector_scores,
    },
  };
}

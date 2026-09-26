export type AnalysisStatus = 'RUNNING' | 'COMPLETED' | 'FAILED';
export type AnalysisTriggeredBy = 'MANUAL' | 'SCHEDULED';
export type AnalysisPhase =
  | 'READINGS'
  | 'BASELINE'
  | 'DETECTION'
  | 'CORRELATION'
  | 'EVENTS'
  | 'EXPLANATION'
  | 'RECOMMENDATION';

export interface AnalysisProgress {
  phase: AnalysisPhase;
  pct: number; // 0-100, progreso global del proceso completo
}

export interface Analysis {
  id: string; // id autogenerado por Firestore
  startedAt: string;
  finishedAt: string | null;
  status: AnalysisStatus;
  errorCode: string | null;
  errorMessage: string | null;
  triggeredBy: AnalysisTriggeredBy;
  metersAnalyzed: string[];
  progress: AnalysisProgress;
  anomaliesCount: number;
  highPriorityCount: number;
}

export interface AnalysisFirestoreDoc {
  started_at: string;
  finished_at: string | null;
  status: AnalysisStatus;
  error_code: string | null;
  error_message: string | null;
  triggered_by: AnalysisTriggeredBy;
  meters_analyzed: string[];
  progress: {
    phase: AnalysisPhase;
    pct: number;
  };
  anomalies_count: number;
  high_priority_count: number;
}

export function toFirestoreDoc(analysis: Analysis): AnalysisFirestoreDoc {
  return {
    started_at: analysis.startedAt,
    finished_at: analysis.finishedAt,
    status: analysis.status,
    error_code: analysis.errorCode,
    error_message: analysis.errorMessage,
    triggered_by: analysis.triggeredBy,
    meters_analyzed: analysis.metersAnalyzed,
    progress: {
      phase: analysis.progress.phase,
      pct: analysis.progress.pct,
    },
    anomalies_count: analysis.anomaliesCount,
    high_priority_count: analysis.highPriorityCount,
  };
}

// `id` no vive dentro del documento: lo asigna Firestore, se pasa aparte.
export function fromFirestoreDoc(
  id: string,
  doc: AnalysisFirestoreDoc,
): Analysis {
  return {
    id,
    startedAt: doc.started_at,
    finishedAt: doc.finished_at,
    status: doc.status,
    errorCode: doc.error_code,
    errorMessage: doc.error_message,
    triggeredBy: doc.triggered_by,
    metersAnalyzed: doc.meters_analyzed,
    progress: {
      phase: doc.progress.phase,
      pct: doc.progress.pct,
    },
    anomaliesCount: doc.anomalies_count,
    highPriorityCount: doc.high_priority_count,
  };
}

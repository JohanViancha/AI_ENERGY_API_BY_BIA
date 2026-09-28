import { Reading } from '../../readings/entities/reading.entity';

export interface RunAnalysisParams {
  meterIds?: string[]; // default: todos los meters (MetersRepository.listAll())
  from?: string; // ISO date; default: min(timestamp) de las lecturas del medidor
  to?: string; // ISO date; default: max(timestamp) de las lecturas del medidor
  windowDays?: number; // alternativa a from/to: últimos N días desde el máximo timestamp disponible
  gapHours?: number; // default 4; separación máxima entre lecturas anómalas para seguir en el mismo tramo
}

export interface HourlyBaseline {
  median: number;
  mad: number; // Median Absolute Deviation
  sampleCount: number;
  isFallback: boolean; // true si sampleCount < 7 y se usó la mediana global del medidor
}

export type DetectorName =
  | 'Z_SCORE'
  | 'IQR_OUTLIER'
  | 'DATA_QUALITY'
  | 'ELECTRICAL_RELATION'
  | 'HOURLY_PATTERN';

export interface DetectionSignal {
  detector: DetectorName;
  value: number; // valor crudo (z, residual, etc.)
}

export interface AnomalyCandidate {
  meterId: string;
  windowStart: string;
  windowEnd: string;
  readings: Reading[]; // lecturas del tramo
  signals: DetectionSignal[]; // unión de señales disparadas por cualquier lectura del tramo
  baselineMedian: number; // mediana de baseline[hora] promediada sobre el tramo
  observedMedian: number; // mediana de consumptionKwh observado en el tramo
  variationPct: number; // (observedMedian - baselineMedian) / baselineMedian × 100
}

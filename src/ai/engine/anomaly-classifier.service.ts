import { Injectable } from '@nestjs/common';
import {
  AnomalySeverity,
  AnomalyType,
} from '../../anomalies/entities/anomaly.entity';
import { AnomalyCandidate } from './types';

const FALSE_POSITIVE_COVERAGE_THRESHOLD = 90;
// Recalibración post-implementación (verificada contra el dataset sembrado): el único
// REAL_ANOMALY del dataset (M-109) varía 98.14% vs. baseline horario — un umbral de 100%
// lo clasificaba como MEDIUM pese a ser la incidencia sin evento explicativo más severa
// del set. Se bajó a 90% para alinear el umbral con el mismo corte de "alta confianza"
// que ya usa `FALSE_POSITIVE_COVERAGE_THRESHOLD`, sin afectar a M-104/M-106/M-112 (ninguno
// pasa por esta rama: se clasifican por cobertura de evento o por DATA_QUALITY).
const HIGH_VARIATION_THRESHOLD = 90;
const MEDIUM_VARIATION_THRESHOLD = 30;

export interface ClassificationResult {
  type: AnomalyType;
  severity: AnomalySeverity;
}

const SEVERITY_WEIGHTS: Record<AnomalySeverity, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export function severityWeight(severity: AnomalySeverity): number {
  return SEVERITY_WEIGHTS[severity];
}

@Injectable()
export class AnomalyClassifierService {
  classify(
    candidate: AnomalyCandidate,
    eventCoveragePct: number,
  ): ClassificationResult {
    const hasDataQuality = candidate.signals.some(
      (signal) => signal.detector === 'DATA_QUALITY',
    );
    if (hasDataQuality) {
      return { type: 'DATA_QUALITY', severity: 'HIGH' };
    }

    if (eventCoveragePct > 0) {
      if (eventCoveragePct > FALSE_POSITIVE_COVERAGE_THRESHOLD) {
        return { type: 'FALSE_POSITIVE', severity: 'LOW' };
      }
      return { type: 'EXPLAINABLE_ANOMALY', severity: 'MEDIUM' };
    }

    return {
      type: 'REAL_ANOMALY',
      severity: this.severityFromVariation(candidate.variationPct),
    };
  }

  private severityFromVariation(variationPct: number): AnomalySeverity {
    const absVariation = Math.abs(variationPct);

    if (absVariation > HIGH_VARIATION_THRESHOLD) {
      return 'HIGH';
    }
    if (absVariation >= MEDIUM_VARIATION_THRESHOLD) {
      return 'MEDIUM';
    }
    return 'LOW';
  }
}

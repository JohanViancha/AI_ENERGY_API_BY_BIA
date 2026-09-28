import { AnomalyCandidate } from './types';

export function buildEvidenceSignals(
  candidate: AnomalyCandidate,
  hasEventMatch: boolean,
): string[] {
  const detectorNames = candidate.signals.map((signal) => signal.detector);
  return [...detectorNames, hasEventMatch ? 'EVENT_MATCH' : 'NO_EVENT'];
}

export function buildDetectorScores(
  candidate: AnomalyCandidate,
  magnitude: number,
  eventClarity: number,
): Record<string, number> {
  const zScore =
    candidate.signals.find((signal) => signal.detector === 'Z_SCORE')?.value ??
    0;
  const iqrResidual =
    candidate.signals.find((signal) => signal.detector === 'IQR_OUTLIER')
      ?.value ?? 0;

  return {
    Z_SCORE: zScore,
    IQR_RESIDUAL: iqrResidual,
    VARIATION_PCT: candidate.variationPct,
    MAGNITUDE: magnitude,
    EVENT_CLARITY: eventClarity,
    SIGNALS_COUNT: candidate.signals.length,
  };
}

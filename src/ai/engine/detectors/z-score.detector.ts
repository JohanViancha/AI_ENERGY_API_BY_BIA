import { Reading } from '../../../readings/entities/reading.entity';
import { DetectionSignal, HourlyBaseline } from '../types';

const ROBUST_CONSTANT = 0.6745;
const Z_SCORE_THRESHOLD = 3;

export function computeRobustZScore(
  value: number,
  baseline: HourlyBaseline,
): number {
  if (baseline.mad === 0) {
    // MAD=0 hace la fórmula indefinida; sin dispersión, cualquier desviación es infinita.
    return value === baseline.median ? 0 : Infinity;
  }

  return (ROBUST_CONSTANT * (value - baseline.median)) / baseline.mad;
}

export function detectZScore(
  reading: Reading,
  baseline: HourlyBaseline,
): DetectionSignal | null {
  const z = computeRobustZScore(reading.consumptionKwh, baseline);

  if (z > Z_SCORE_THRESHOLD) {
    return { detector: 'Z_SCORE', value: z };
  }

  return null;
}

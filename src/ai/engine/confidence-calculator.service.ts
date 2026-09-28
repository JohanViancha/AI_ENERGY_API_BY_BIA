import { Injectable } from '@nestjs/common';
import { AnomalyCandidate } from './types';

const MAX_CONFIDENCE = 0.99;
const BASE_CONFIDENCE = 0.4;
const WEIGHT = 0.2;

const SIGNALS_DIVISOR = 3;
const Z_SCORE_DIVISOR = 6;
const VARIATION_PCT_DIVISOR = 150;

const EVENT_CLARITY_NONE = 0.85;
const EVENT_CLARITY_HIGH = 1.0;
const EVENT_CLARITY_MEDIUM = 0.7;
const EVENT_CLARITY_LOW = 0.4;
const HIGH_COVERAGE_THRESHOLD = 90;
const MEDIUM_COVERAGE_THRESHOLD = 50;

const FALLBACK_PENALTY = 0.5;

export interface ConfidenceInput {
  candidate: AnomalyCandidate;
  eventCoveragePct: number;
  isFallbackByReading: boolean[]; // alineado con candidate.readings, uno por lectura
}

@Injectable()
export class ConfidenceCalculatorService {
  calculate(input: ConfidenceInput): number {
    const { candidate, eventCoveragePct, isFallbackByReading } = input;

    const signalsMatch = Math.min(
      1,
      candidate.signals.length / SIGNALS_DIVISOR,
    );
    const magnitude = this.computeMagnitude(candidate);
    const eventClarity = this.computeEventClarity(eventCoveragePct);

    const confidence = Math.min(
      MAX_CONFIDENCE,
      BASE_CONFIDENCE +
        WEIGHT * signalsMatch +
        WEIGHT * magnitude +
        WEIGHT * eventClarity,
    );

    if (this.isMajorityFallback(isFallbackByReading)) {
      return confidence * FALLBACK_PENALTY;
    }

    return confidence;
  }

  computeMagnitude(candidate: AnomalyCandidate): number {
    const zScoreSignal = candidate.signals.find(
      (signal) => signal.detector === 'Z_SCORE',
    );
    const zScoreRobusto = zScoreSignal?.value ?? 0;
    const variationComponent =
      Math.abs(candidate.variationPct) / VARIATION_PCT_DIVISOR;

    return Math.min(
      1,
      Math.max(zScoreRobusto / Z_SCORE_DIVISOR, variationComponent),
    );
  }

  computeEventClarity(eventCoveragePct: number): number {
    if (eventCoveragePct === 0) {
      return EVENT_CLARITY_NONE;
    }
    if (eventCoveragePct > HIGH_COVERAGE_THRESHOLD) {
      return EVENT_CLARITY_HIGH;
    }
    if (eventCoveragePct >= MEDIUM_COVERAGE_THRESHOLD) {
      return EVENT_CLARITY_MEDIUM;
    }
    return EVENT_CLARITY_LOW;
  }

  private isMajorityFallback(isFallbackByReading: boolean[]): boolean {
    if (isFallbackByReading.length === 0) {
      return false;
    }

    const fallbackCount = isFallbackByReading.filter(Boolean).length;
    return fallbackCount / isFallbackByReading.length > 0.5;
  }
}

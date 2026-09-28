import { Reading } from '../../../readings/entities/reading.entity';
import { DetectionSignal } from '../types';

const RELATIVE_ERROR_TOLERANCE = 0.15;

export function computeRelativeError(reading: Reading): number {
  const expectedWatts = reading.voltage * reading.current * reading.powerFactor;
  const observedWatts = reading.consumptionKwh * 1000;

  if (observedWatts === 0) {
    // Consumo cero: la relación esperada también debería ser cero; si no lo es, el desfase es total.
    return expectedWatts === 0 ? 0 : Infinity;
  }

  return Math.abs(expectedWatts - observedWatts) / observedWatts;
}

export function detectElectricalRelation(
  reading: Reading,
): DetectionSignal | null {
  const relativeError = computeRelativeError(reading);

  if (relativeError > RELATIVE_ERROR_TOLERANCE) {
    return { detector: 'ELECTRICAL_RELATION', value: relativeError };
  }

  return null;
}

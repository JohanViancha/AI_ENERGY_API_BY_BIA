import { Reading } from '../../../readings/entities/reading.entity';
import { DetectionSignal } from '../types';

// El ruido normal de sensor/redondeo en el dataset sembrado ya alcanza 15-27% de error
// relativo (p97≈16.7%, p99≈26.8% sobre las 4032 lecturas); 15% marcaba como anomalía
// lecturas perfectamente normales.
const RELATIVE_ERROR_TOLERANCE = 0.3;

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

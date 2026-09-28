import { Reading } from '../../../readings/entities/reading.entity';
import { getHourOfDay } from '../date-utils';
import { DetectionSignal, HourlyBaseline } from '../types';

const SHAPE_DISTANCE_THRESHOLD = 0.15;
const MIN_HOURS_TO_COMPARE = 2;

/**
 * Distancia de variación total entre el perfil horario observado ese día y el
 * perfil histórico del medidor, ambos normalizados a que sumen 1 (elimina el
 * "nivel" y deja solo la "forma"). Solo se comparan las horas con lectura ese día.
 */
export function computeShapeDistance(
  dayReadings: Reading[],
  historicalProfile: HourlyBaseline[],
): number | null {
  if (dayReadings.length < MIN_HOURS_TO_COMPARE) {
    return null;
  }

  const observedValues = dayReadings.map((r) => r.consumptionKwh);
  const historicalValues = dayReadings.map(
    (r) => historicalProfile[getHourOfDay(r.timestamp)].median,
  );

  const observedSum = observedValues.reduce((sum, v) => sum + v, 0);
  const historicalSum = historicalValues.reduce((sum, v) => sum + v, 0);

  if (observedSum === 0 || historicalSum === 0) {
    return null;
  }

  const totalVariationDistance = observedValues.reduce((distance, value, i) => {
    const normObserved = value / observedSum;
    const normHistorical = historicalValues[i] / historicalSum;
    return distance + Math.abs(normObserved - normHistorical);
  }, 0);

  return 0.5 * totalVariationDistance;
}

export function detectHourlyPattern(
  reading: Reading,
  dayReadings: Reading[],
  historicalProfile: HourlyBaseline[],
): DetectionSignal | null {
  const distance = computeShapeDistance(dayReadings, historicalProfile);

  if (distance !== null && distance > SHAPE_DISTANCE_THRESHOLD) {
    return { detector: 'HOURLY_PATTERN', value: distance };
  }

  return null;
}

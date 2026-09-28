import { Reading } from '../../../readings/entities/reading.entity';
import { quartiles } from '../stats';
import { DetectionSignal, HourlyBaseline } from '../types';

const IQR_MULTIPLIER = 1.5;

export interface IqrBounds {
  lowerBound: number;
  upperBound: number;
}

/**
 * Q1/Q3 se calculan sobre TODOS los residuos (x - baseline[hora]) de un medidor
 * en toda la corrida, no por hora — mismo alcance temporal que el baseline
 * (mediana+MAD), para evitar el problema de pocas muestras por hora.
 */
export function computeIqrBounds(residuals: number[]): IqrBounds {
  const { q1, q3 } = quartiles(residuals);
  const iqr = q3 - q1;

  return {
    lowerBound: q1 - IQR_MULTIPLIER * iqr,
    upperBound: q3 + IQR_MULTIPLIER * iqr,
  };
}

export function detectIqrOutlier(
  reading: Reading,
  baseline: HourlyBaseline,
  bounds: IqrBounds,
): DetectionSignal | null {
  const residual = reading.consumptionKwh - baseline.median;

  if (residual < bounds.lowerBound || residual > bounds.upperBound) {
    return { detector: 'IQR_OUTLIER', value: residual };
  }

  return null;
}

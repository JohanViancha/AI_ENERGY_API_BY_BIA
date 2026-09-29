import { Reading } from '../../../readings/entities/reading.entity';
import { DetectionSignal, HourlyBaseline } from '../types';

const ROBUST_CONSTANT = 0.6745;
// Con solo ~14 muestras por hora-del-día, el MAD muestral subestima la dispersión real
// (efecto conocido de estimadores robustos en N pequeño), así que un umbral de 3 dispara
// sobre ruido normal. 5.5 es el primer entero-y-medio por encima del z máximo observado
// en lecturas de fondo (sin incidente conocido) del dataset sembrado (~5.2).
const Z_SCORE_THRESHOLD = 5.5;

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

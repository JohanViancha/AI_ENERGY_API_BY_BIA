import { Reading } from '../../../readings/entities/reading.entity';
import { DetectionSignal } from '../types';

const MIN_VOLTAGE = 100;
const MAX_VOLTAGE = 500;
const MIN_POWER_FACTOR = 0.7;
const MAX_POWER_FACTOR = 1;

export function detectDataQuality(reading: Reading): DetectionSignal | null {
  const isTriggered =
    reading.status !== 'OK' ||
    reading.voltage < MIN_VOLTAGE ||
    reading.voltage > MAX_VOLTAGE ||
    (reading.current <= 0 && reading.consumptionKwh > 0) ||
    reading.powerFactor < MIN_POWER_FACTOR ||
    reading.powerFactor > MAX_POWER_FACTOR;

  return isTriggered ? { detector: 'DATA_QUALITY', value: 1 } : null;
}

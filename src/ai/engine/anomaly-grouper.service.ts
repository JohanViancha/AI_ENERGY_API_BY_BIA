import { Injectable } from '@nestjs/common';
import { Reading } from '../../readings/entities/reading.entity';
import { median } from './stats';
import { AnomalyCandidate, DetectionSignal } from './types';

const DEFAULT_GAP_HOURS = 4;
const MS_PER_HOUR = 60 * 60 * 1000;

export interface AnomalousReadingInput {
  reading: Reading;
  signals: DetectionSignal[];
  baselineMedian: number; // baseline[hora].median para la hora de esta lectura
}

@Injectable()
export class AnomalyGrouperService {
  group(
    inputs: AnomalousReadingInput[],
    gapHours: number = DEFAULT_GAP_HOURS,
  ): AnomalyCandidate[] {
    const anomalous = inputs.filter((input) => input.signals.length > 0);

    const byMeter = new Map<string, AnomalousReadingInput[]>();
    for (const input of anomalous) {
      const meterInputs = byMeter.get(input.reading.meterId) ?? [];
      meterInputs.push(input);
      byMeter.set(input.reading.meterId, meterInputs);
    }

    const candidates: AnomalyCandidate[] = [];
    for (const [meterId, meterInputs] of byMeter) {
      candidates.push(...this.groupMeterInputs(meterId, meterInputs, gapHours));
    }

    return candidates;
  }

  private groupMeterInputs(
    meterId: string,
    inputs: AnomalousReadingInput[],
    gapHours: number,
  ): AnomalyCandidate[] {
    const sorted = [...inputs].sort(
      (a, b) =>
        new Date(a.reading.timestamp).getTime() -
        new Date(b.reading.timestamp).getTime(),
    );

    const windows: AnomalousReadingInput[][] = [];
    let currentWindow: AnomalousReadingInput[] = [];

    for (const input of sorted) {
      const previous = currentWindow[currentWindow.length - 1];

      if (
        previous &&
        this.hoursBetween(previous.reading, input.reading) >= gapHours
      ) {
        windows.push(currentWindow);
        currentWindow = [];
      }

      currentWindow.push(input);
    }

    if (currentWindow.length > 0) {
      windows.push(currentWindow);
    }

    return windows.map((window) => this.buildCandidate(meterId, window));
  }

  private hoursBetween(a: Reading, b: Reading): number {
    return (
      (new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) /
      MS_PER_HOUR
    );
  }

  private buildCandidate(
    meterId: string,
    window: AnomalousReadingInput[],
  ): AnomalyCandidate {
    const readings = window.map((input) => input.reading);
    const observedMedian = median(readings.map((r) => r.consumptionKwh));
    const baselineMedian =
      window.reduce((sum, input) => sum + input.baselineMedian, 0) /
      window.length;

    return {
      meterId,
      windowStart: readings[0].timestamp,
      windowEnd: readings[readings.length - 1].timestamp,
      readings,
      signals: this.mergeSignals(window),
      baselineMedian,
      observedMedian,
      variationPct: this.computeVariationPct(observedMedian, baselineMedian),
    };
  }

  private computeVariationPct(
    observedMedian: number,
    baselineMedian: number,
  ): number {
    if (baselineMedian === 0) {
      // Sin baseline de referencia, cualquier consumo observado no nulo es una variación infinita.
      return observedMedian === 0 ? 0 : Infinity;
    }

    return ((observedMedian - baselineMedian) / baselineMedian) * 100;
  }

  private mergeSignals(window: AnomalousReadingInput[]): DetectionSignal[] {
    const byDetector = new Map<string, DetectionSignal>();

    for (const input of window) {
      for (const signal of input.signals) {
        const existing = byDetector.get(signal.detector);
        if (!existing || Math.abs(signal.value) > Math.abs(existing.value)) {
          byDetector.set(signal.detector, signal);
        }
      }
    }

    return [...byDetector.values()];
  }
}

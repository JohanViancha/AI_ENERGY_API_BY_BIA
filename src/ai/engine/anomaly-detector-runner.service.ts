import { Injectable } from '@nestjs/common';
import { Reading } from '../../readings/entities/reading.entity';
import {
  AnomalousReadingInput,
  AnomalyGrouperService,
} from './anomaly-grouper.service';
import { getCalendarDayKey, getHourOfDay } from './date-utils';
import { detectDataQuality } from './detectors/data-quality.detector';
import { detectElectricalRelation } from './detectors/electrical-relation.detector';
import { detectHourlyPattern } from './detectors/hourly-pattern.detector';
import { computeIqrBounds, detectIqrOutlier } from './detectors/iqr.detector';
import { detectZScore } from './detectors/z-score.detector';
import { AnomalyCandidate, HourlyBaseline } from './types';

@Injectable()
export class AnomalyDetectorRunnerService {
  constructor(private readonly anomalyGrouper: AnomalyGrouperService) {}

  run(
    meterIds: string[],
    readingsByMeter: Map<string, Reading[]>,
    baselines: Map<string, HourlyBaseline[]>,
    gapHours: number | undefined,
  ): AnomalyCandidate[] {
    const anomalousInputs: AnomalousReadingInput[] = [];

    for (const meterId of meterIds) {
      const meterReadings = readingsByMeter.get(meterId) ?? [];
      const meterBaseline = baselines.get(meterId);
      if (!meterBaseline) {
        continue;
      }

      const residuals = meterReadings.map(
        (reading) =>
          reading.consumptionKwh -
          meterBaseline[getHourOfDay(reading.timestamp)].median,
      );
      const iqrBounds = computeIqrBounds(residuals);
      const readingsByDay = this.groupByCalendarDay(meterReadings);

      for (const reading of meterReadings) {
        const hourBaseline = meterBaseline[getHourOfDay(reading.timestamp)];
        const dayReadings = readingsByDay.get(
          getCalendarDayKey(reading.timestamp),
        ) ?? [reading];

        const signals = [
          detectZScore(reading, hourBaseline),
          detectIqrOutlier(reading, hourBaseline, iqrBounds),
          detectDataQuality(reading),
          detectElectricalRelation(reading),
          detectHourlyPattern(reading, dayReadings, meterBaseline),
        ].filter((signal) => signal !== null);

        anomalousInputs.push({
          reading,
          signals,
          baselineMedian: hourBaseline.median,
        });
      }
    }

    return this.anomalyGrouper.group(anomalousInputs, gapHours);
  }

  private groupByCalendarDay(readings: Reading[]): Map<string, Reading[]> {
    const byDay = new Map<string, Reading[]>();

    for (const reading of readings) {
      const key = getCalendarDayKey(reading.timestamp);
      const dayReadings = byDay.get(key) ?? [];
      dayReadings.push(reading);
      byDay.set(key, dayReadings);
    }

    return byDay;
  }
}

import { Injectable } from '@nestjs/common';
import { Reading } from '../../readings/entities/reading.entity';
import { median, medianAbsoluteDeviation } from './stats';
import { HourlyBaseline } from './types';

const HOURS_PER_DAY = 24;
const MIN_SAMPLES_PER_HOUR = 7;

function getHourOfDay(timestamp: string): number {
  return new Date(timestamp).getUTCHours();
}

@Injectable()
export class BaselineCalculatorService {
  calculate(readings: Reading[]): Map<string, HourlyBaseline[]> {
    const readingsByMeter = new Map<string, Reading[]>();

    for (const reading of readings) {
      const meterReadings = readingsByMeter.get(reading.meterId) ?? [];
      meterReadings.push(reading);
      readingsByMeter.set(reading.meterId, meterReadings);
    }

    const baselines = new Map<string, HourlyBaseline[]>();

    for (const [meterId, meterReadings] of readingsByMeter) {
      baselines.set(meterId, this.calculateForMeter(meterReadings));
    }

    return baselines;
  }

  private calculateForMeter(readings: Reading[]): HourlyBaseline[] {
    const globalValues = readings.map((reading) => reading.consumptionKwh);
    const globalMedian = median(globalValues);
    const globalMad = medianAbsoluteDeviation(globalValues, globalMedian);

    const valuesByHour: number[][] = Array.from(
      { length: HOURS_PER_DAY },
      () => [],
    );
    for (const reading of readings) {
      valuesByHour[getHourOfDay(reading.timestamp)].push(
        reading.consumptionKwh,
      );
    }

    return valuesByHour.map((hourValues) => {
      const sampleCount = hourValues.length;

      if (sampleCount < MIN_SAMPLES_PER_HOUR) {
        return {
          median: globalMedian,
          mad: globalMad,
          sampleCount,
          isFallback: true,
        };
      }

      const hourMedian = median(hourValues);
      return {
        median: hourMedian,
        mad: medianAbsoluteDeviation(hourValues, hourMedian),
        sampleCount,
        isFallback: false,
      };
    });
  }
}

import { Injectable } from '@nestjs/common';
import { OperationalEvent } from '../../events/entities/operational-event.entity';
import { EventsRepository } from '../../events/events.repository';
import { Reading } from '../../readings/entities/reading.entity';
import { ReadingsRepository } from '../../readings/readings.repository';
import { RunAnalysisParams } from './types';

const DEFAULT_FROM = '0001-01-01T00:00:00.000Z';
const DEFAULT_TO = '9999-12-31T23:59:59.999Z';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class ReadingEventLoaderService {
  constructor(
    private readonly readingsRepository: ReadingsRepository,
    private readonly eventsRepository: EventsRepository,
  ) {}

  async loadReadings(
    meterIds: string[],
    params: RunAnalysisParams,
  ): Promise<Map<string, Reading[]>> {
    const readingsByMeter = new Map<string, Reading[]>();

    for (const meterId of meterIds) {
      const from = params.from ?? DEFAULT_FROM;
      const to = params.to ?? DEFAULT_TO;
      let readings = await this.readingsRepository.findByMeterAndRange(
        meterId,
        from,
        to,
      );

      if (params.windowDays !== undefined && !params.from && !params.to) {
        readings = this.filterByWindowDays(readings, params.windowDays);
      }

      readingsByMeter.set(meterId, readings);
    }

    return readingsByMeter;
  }

  async loadEvents(
    meterIds: string[],
    params: RunAnalysisParams,
  ): Promise<Map<string, OperationalEvent[]>> {
    const eventsByMeter = new Map<string, OperationalEvent[]>();

    for (const meterId of meterIds) {
      const from = params.from ?? DEFAULT_FROM;
      const to = params.to ?? DEFAULT_TO;
      const events = await this.eventsRepository.findByMeterAndRange(
        meterId,
        from,
        to,
      );
      eventsByMeter.set(meterId, events);
    }

    return eventsByMeter;
  }

  private filterByWindowDays(
    readings: Reading[],
    windowDays: number,
  ): Reading[] {
    if (readings.length === 0) {
      return readings;
    }

    const maxTimestamp = Math.max(
      ...readings.map((reading) => new Date(reading.timestamp).getTime()),
    );
    const cutoff = maxTimestamp - windowDays * MS_PER_DAY;

    return readings.filter(
      (reading) => new Date(reading.timestamp).getTime() >= cutoff,
    );
  }
}

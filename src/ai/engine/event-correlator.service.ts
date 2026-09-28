import { Injectable } from '@nestjs/common';
import { OperationalEvent } from '../../events/entities/operational-event.entity';
import { AnomalyCandidate } from './types';

const EXCLUDED_EVENT_TYPES = new Set(['UNKNOWN', 'DATA_QUALITY']);
const DEFAULT_EVENT_WINDOW_HOURS = 24;
const MIN_CANDIDATE_WINDOW_HOURS = 1;
const MS_PER_HOUR = 60 * 60 * 1000;

export interface EventCorrelationResult {
  coveragePct: number; // 0-100, cobertura temporal del tramo por eventos reales
  matchedEvents: OperationalEvent[]; // eventos reales (excluye UNKNOWN/DATA_QUALITY) que se solapan con el tramo
}

interface TimeInterval {
  start: number; // epoch ms
  end: number;
}

@Injectable()
export class EventCorrelatorService {
  correlate(
    candidate: AnomalyCandidate,
    events: OperationalEvent[],
  ): EventCorrelationResult {
    const candidateInterval = this.getCandidateInterval(candidate);
    const qualifyingEvents = events.filter(
      (event) =>
        event.meterId === candidate.meterId &&
        !EXCLUDED_EVENT_TYPES.has(event.eventType),
    );

    const overlaps: TimeInterval[] = [];
    const matchedEvents: OperationalEvent[] = [];

    for (const event of qualifyingEvents) {
      const overlap = this.intersect(
        candidateInterval,
        this.getEventInterval(event),
      );

      if (overlap) {
        overlaps.push(overlap);
        matchedEvents.push(event);
      }
    }

    const coveredMs = this.unionDuration(overlaps);
    const candidateDurationMs = candidateInterval.end - candidateInterval.start;
    const coveragePct =
      candidateDurationMs === 0
        ? 0
        : Math.min(100, (coveredMs / candidateDurationMs) * 100);

    return { coveragePct, matchedEvents };
  }

  private getCandidateInterval(candidate: AnomalyCandidate): TimeInterval {
    const start = new Date(candidate.windowStart).getTime();
    const rawEnd = new Date(candidate.windowEnd).getTime();
    // Tramo de una sola lectura (windowStart === windowEnd): las lecturas son de
    // granularidad horaria, así que su ventana efectiva cubre al menos esa hora.
    const end =
      rawEnd > start
        ? rawEnd
        : start + MIN_CANDIDATE_WINDOW_HOURS * MS_PER_HOUR;

    return { start, end };
  }

  private getEventInterval(event: OperationalEvent): TimeInterval {
    const eventStart = new Date(event.eventTimestamp).getTime();

    if (event.durationHours === null) {
      return {
        start: eventStart - DEFAULT_EVENT_WINDOW_HOURS * MS_PER_HOUR,
        end: eventStart + DEFAULT_EVENT_WINDOW_HOURS * MS_PER_HOUR,
      };
    }

    return {
      start: eventStart,
      end: eventStart + event.durationHours * MS_PER_HOUR,
    };
  }

  private intersect(a: TimeInterval, b: TimeInterval): TimeInterval | null {
    const start = Math.max(a.start, b.start);
    const end = Math.min(a.end, b.end);

    return end > start ? { start, end } : null;
  }

  private unionDuration(intervals: TimeInterval[]): number {
    if (intervals.length === 0) {
      return 0;
    }

    const sorted = [...intervals].sort((a, b) => a.start - b.start);
    let totalMs = 0;
    let currentStart = sorted[0].start;
    let currentEnd = sorted[0].end;

    for (const interval of sorted.slice(1)) {
      if (interval.start <= currentEnd) {
        currentEnd = Math.max(currentEnd, interval.end);
      } else {
        totalMs += currentEnd - currentStart;
        currentStart = interval.start;
        currentEnd = interval.end;
      }
    }
    totalMs += currentEnd - currentStart;

    return totalMs;
  }
}

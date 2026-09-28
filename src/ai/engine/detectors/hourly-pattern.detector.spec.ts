import { Reading } from '../../../readings/entities/reading.entity';
import { HourlyBaseline } from '../types';
import {
  computeShapeDistance,
  detectHourlyPattern,
} from './hourly-pattern.detector';

function readingAtHour(hour: number, consumptionKwh: number): Reading {
  const timestamp = new Date(Date.UTC(2026, 0, 1, hour, 0, 0)).toISOString();
  return {
    meterId: 'M-001',
    timestamp,
    consumptionKwh,
    voltage: 220,
    current: 10,
    powerFactor: 0.95,
    status: 'OK',
  };
}

function makeHistoricalProfile(
  hour0Median: number,
  hour1Median: number,
): HourlyBaseline[] {
  const flatBaseline: HourlyBaseline = {
    median: 0,
    mad: 0,
    sampleCount: 0,
    isFallback: true,
  };
  const profile = Array.from({ length: 24 }, () => ({ ...flatBaseline }));
  profile[0] = {
    median: hour0Median,
    mad: 0,
    sampleCount: 10,
    isFallback: false,
  };
  profile[1] = {
    median: hour1Median,
    mad: 0,
    sampleCount: 10,
    isFallback: false,
  };
  return profile;
}

// Perfil histórico 50/50 entre hora 0 y hora 1.
const historicalProfile = makeHistoricalProfile(1, 1);

describe('computeShapeDistance / detectHourlyPattern', () => {
  it('calcula la distancia de variación total esperada (observado 65/35 vs histórico 50/50 → 0.15)', () => {
    // Solo verifica el valor numérico; el umbral en sí se prueba con márgenes
    // que no dependen de la precisión exacta de flotantes en 0.15.
    const dayReadings = [readingAtHour(0, 65), readingAtHour(1, 35)];
    expect(computeShapeDistance(dayReadings, historicalProfile)).toBeCloseTo(
      0.15,
    );
  });

  it('dispara por encima del umbral (distancia = 0.16)', () => {
    const dayReadings = [readingAtHour(0, 66), readingAtHour(1, 34)];
    const signal = detectHourlyPattern(
      dayReadings[0],
      dayReadings,
      historicalProfile,
    );
    expect(signal?.detector).toBe('HOURLY_PATTERN');
    expect(signal?.value).toBeCloseTo(0.16);
  });

  it('no dispara por debajo del umbral (distancia = 0.10)', () => {
    const dayReadings = [readingAtHour(0, 60), readingAtHour(1, 40)];
    expect(
      detectHourlyPattern(dayReadings[0], dayReadings, historicalProfile),
    ).toBeNull();
  });

  it('no dispara (retorna null) cuando solo hay una lectura ese día', () => {
    const dayReadings = [readingAtHour(0, 65)];
    expect(computeShapeDistance(dayReadings, historicalProfile)).toBeNull();
    expect(
      detectHourlyPattern(dayReadings[0], dayReadings, historicalProfile),
    ).toBeNull();
  });

  it('no dispara cuando el perfil histórico de esas horas es todo cero', () => {
    const zeroProfile = makeHistoricalProfile(0, 0);
    const dayReadings = [readingAtHour(0, 65), readingAtHour(1, 35)];
    expect(computeShapeDistance(dayReadings, zeroProfile)).toBeNull();
  });
});

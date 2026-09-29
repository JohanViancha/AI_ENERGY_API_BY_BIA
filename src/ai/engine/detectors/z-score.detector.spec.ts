import { Reading } from '../../../readings/entities/reading.entity';
import { HourlyBaseline } from '../types';
import { computeRobustZScore, detectZScore } from './z-score.detector';

function makeReading(consumptionKwh: number): Reading {
  return {
    meterId: 'M-001',
    timestamp: '2026-01-01T05:00:00.000Z',
    consumptionKwh,
    voltage: 220,
    current: 10,
    powerFactor: 0.95,
    status: 'OK',
  };
}

// median=0, mad=0.6745 hace que z = 0.6745*(x-0)/0.6745 = x, para valores de prueba limpios.
const baseline: HourlyBaseline = {
  median: 0,
  mad: 0.6745,
  sampleCount: 10,
  isFallback: false,
};

describe('detectZScore', () => {
  it('no dispara justo en el umbral (z = 5.5)', () => {
    expect(detectZScore(makeReading(5.5), baseline)).toBeNull();
  });

  it('dispara por encima del umbral (z = 6)', () => {
    const signal = detectZScore(makeReading(6), baseline);
    expect(signal).toEqual({ detector: 'Z_SCORE', value: 6 });
  });

  it('no dispara por debajo del umbral (z = 2)', () => {
    expect(detectZScore(makeReading(2), baseline)).toBeNull();
  });

  it('no dispara para desviaciones negativas grandes (fórmula es unidireccional, z > 3)', () => {
    expect(detectZScore(makeReading(-100), baseline)).toBeNull();
  });

  it('con MAD=0 y valor igual a la mediana, z=0 y no dispara', () => {
    const flatBaseline: HourlyBaseline = {
      median: 10,
      mad: 0,
      sampleCount: 10,
      isFallback: false,
    };
    expect(computeRobustZScore(10, flatBaseline)).toBe(0);
    expect(detectZScore(makeReading(10), flatBaseline)).toBeNull();
  });

  it('con MAD=0 y valor distinto a la mediana, z=Infinity y dispara', () => {
    const flatBaseline: HourlyBaseline = {
      median: 10,
      mad: 0,
      sampleCount: 10,
      isFallback: false,
    };
    const signal = detectZScore(makeReading(11), flatBaseline);
    expect(signal).toEqual({ detector: 'Z_SCORE', value: Infinity });
  });
});

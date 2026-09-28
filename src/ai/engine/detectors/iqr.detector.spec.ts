import { Reading } from '../../../readings/entities/reading.entity';
import { HourlyBaseline } from '../types';
import { computeIqrBounds, detectIqrOutlier, IqrBounds } from './iqr.detector';

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

const baseline: HourlyBaseline = {
  median: 10,
  mad: 1,
  sampleCount: 7,
  isFallback: false,
};

describe('computeIqrBounds', () => {
  it('calcula Q1, Q3 e IQR sobre el conjunto completo de residuos', () => {
    const residuals = [1, 2, 3, 4, 5, 6, 7];
    // q1 = mediana(1,2,3) = 2; q3 = mediana(5,6,7) = 6; IQR = 4
    const bounds = computeIqrBounds(residuals);
    expect(bounds.lowerBound).toBe(2 - 1.5 * 4);
    expect(bounds.upperBound).toBe(6 + 1.5 * 4);
  });
});

describe('detectIqrOutlier', () => {
  const bounds: IqrBounds = { lowerBound: -4, upperBound: 12 };

  it('no dispara justo en el límite superior (residual = 12)', () => {
    // consumptionKwh=22, median=10 → residual=12
    expect(detectIqrOutlier(makeReading(22), baseline, bounds)).toBeNull();
  });

  it('dispara por encima del límite superior (residual = 12.1)', () => {
    const signal = detectIqrOutlier(makeReading(22.1), baseline, bounds);
    expect(signal?.detector).toBe('IQR_OUTLIER');
    expect(signal?.value).toBeCloseTo(12.1);
  });

  it('no dispara justo en el límite inferior (residual = -4)', () => {
    // consumptionKwh=6, median=10 → residual=-4
    expect(detectIqrOutlier(makeReading(6), baseline, bounds)).toBeNull();
  });

  it('dispara por debajo del límite inferior (residual = -4.1)', () => {
    const signal = detectIqrOutlier(makeReading(5.9), baseline, bounds);
    expect(signal?.detector).toBe('IQR_OUTLIER');
    expect(signal?.value).toBeCloseTo(-4.1);
  });

  it('no dispara dentro del rango', () => {
    expect(detectIqrOutlier(makeReading(10), baseline, bounds)).toBeNull();
  });
});

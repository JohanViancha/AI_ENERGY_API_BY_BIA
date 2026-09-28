import { Reading } from '../../../readings/entities/reading.entity';
import { detectDataQuality } from './data-quality.detector';

function makeReading(overrides: Partial<Reading> = {}): Reading {
  return {
    meterId: 'M-001',
    timestamp: '2026-01-01T05:00:00.000Z',
    consumptionKwh: 50,
    voltage: 220,
    current: 10,
    powerFactor: 0.95,
    status: 'OK',
    ...overrides,
  };
}

describe('detectDataQuality', () => {
  it('no dispara para una lectura sana', () => {
    expect(detectDataQuality(makeReading())).toBeNull();
  });

  it('dispara cuando status !== OK', () => {
    expect(detectDataQuality(makeReading({ status: 'INVALID' }))).toEqual({
      detector: 'DATA_QUALITY',
      value: 1,
    });
  });

  it('no dispara con voltage justo en el límite inferior (100)', () => {
    expect(detectDataQuality(makeReading({ voltage: 100 }))).toBeNull();
  });

  it('dispara con voltage por debajo del límite inferior (99.9)', () => {
    expect(detectDataQuality(makeReading({ voltage: 99.9 }))).toEqual({
      detector: 'DATA_QUALITY',
      value: 1,
    });
  });

  it('no dispara con voltage justo en el límite superior (500)', () => {
    expect(detectDataQuality(makeReading({ voltage: 500 }))).toBeNull();
  });

  it('dispara con voltage por encima del límite superior (500.1)', () => {
    expect(detectDataQuality(makeReading({ voltage: 500.1 }))).toEqual({
      detector: 'DATA_QUALITY',
      value: 1,
    });
  });

  it('no dispara con current=0 si consumptionKwh también es 0', () => {
    expect(
      detectDataQuality(makeReading({ current: 0, consumptionKwh: 0 })),
    ).toBeNull();
  });

  it('dispara con current=0 si consumptionKwh > 0', () => {
    expect(
      detectDataQuality(makeReading({ current: 0, consumptionKwh: 5 })),
    ).toEqual({
      detector: 'DATA_QUALITY',
      value: 1,
    });
  });

  it('dispara con current negativo y consumptionKwh > 0', () => {
    expect(
      detectDataQuality(makeReading({ current: -1, consumptionKwh: 5 })),
    ).toEqual({
      detector: 'DATA_QUALITY',
      value: 1,
    });
  });

  it('no dispara con powerFactor justo en el límite inferior (0.7)', () => {
    expect(detectDataQuality(makeReading({ powerFactor: 0.7 }))).toBeNull();
  });

  it('dispara con powerFactor por debajo del límite inferior (0.69)', () => {
    expect(detectDataQuality(makeReading({ powerFactor: 0.69 }))).toEqual({
      detector: 'DATA_QUALITY',
      value: 1,
    });
  });

  it('no dispara con powerFactor justo en el límite superior (1)', () => {
    expect(detectDataQuality(makeReading({ powerFactor: 1 }))).toBeNull();
  });

  it('dispara con powerFactor por encima del límite superior (1.01)', () => {
    expect(detectDataQuality(makeReading({ powerFactor: 1.01 }))).toEqual({
      detector: 'DATA_QUALITY',
      value: 1,
    });
  });
});

import { Reading } from '../../../readings/entities/reading.entity';
import {
  computeRelativeError,
  detectElectricalRelation,
} from './electrical-relation.detector';

function makeReading(overrides: Partial<Reading> = {}): Reading {
  return {
    meterId: 'M-001',
    timestamp: '2026-01-01T05:00:00.000Z',
    consumptionKwh: 1,
    voltage: 1150,
    current: 1,
    powerFactor: 1,
    status: 'OK',
    ...overrides,
  };
}

describe('detectElectricalRelation', () => {
  it('no dispara justo en el umbral (error relativo = 0.3)', () => {
    // V×I×PF = 1300, consumo×1000 = 1000 → error = 300/1000 = 0.3
    const reading = makeReading({ voltage: 1300 });
    expect(computeRelativeError(reading)).toBeCloseTo(0.3);
    expect(detectElectricalRelation(reading)).toBeNull();
  });

  it('dispara por encima del umbral (error relativo = 0.301)', () => {
    const reading = makeReading({ voltage: 1301 });
    const signal = detectElectricalRelation(reading);
    expect(signal?.detector).toBe('ELECTRICAL_RELATION');
    expect(signal?.value).toBeCloseTo(0.301);
  });

  it('no dispara por debajo del umbral (error relativo = 0.25)', () => {
    const reading = makeReading({ voltage: 1250 });
    expect(detectElectricalRelation(reading)).toBeNull();
  });

  it('no dispara cuando consumo y relación esperada son ambos cero', () => {
    const reading = makeReading({ consumptionKwh: 0, voltage: 0, current: 0 });
    expect(computeRelativeError(reading)).toBe(0);
    expect(detectElectricalRelation(reading)).toBeNull();
  });

  it('dispara con error infinito cuando consumo es cero pero hay potencia eléctrica', () => {
    const reading = makeReading({
      consumptionKwh: 0,
      voltage: 220,
      current: 10,
      powerFactor: 0.95,
    });
    const signal = detectElectricalRelation(reading);
    expect(signal).toEqual({
      detector: 'ELECTRICAL_RELATION',
      value: Infinity,
    });
  });
});

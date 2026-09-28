import { Reading } from '../../readings/entities/reading.entity';
import { BaselineCalculatorService } from './baseline-calculator.service';

function makeReading(overrides: Partial<Reading>): Reading {
  return {
    meterId: 'M-001',
    timestamp: '2026-01-01T00:00:00.000Z',
    consumptionKwh: 50,
    voltage: 220,
    current: 10,
    powerFactor: 0.95,
    status: 'OK',
    ...overrides,
  };
}

function readingAtHour(
  hour: number,
  consumptionKwh: number,
  meterId = 'M-001',
): Reading {
  const timestamp = new Date(Date.UTC(2026, 0, 1, hour, 0, 0)).toISOString();
  return makeReading({ meterId, timestamp, consumptionKwh });
}

describe('BaselineCalculatorService', () => {
  let service: BaselineCalculatorService;

  beforeEach(() => {
    service = new BaselineCalculatorService();
  });

  it('devuelve un baseline de 24 horas por medidor', () => {
    const readings = [readingAtHour(0, 50)];

    const baselines = service.calculate(readings);

    expect(baselines.get('M-001')).toHaveLength(24);
  });

  it('calcula mediana y MAD correctos cuando hay suficientes muestras en la hora', () => {
    const values = [10, 12, 11, 13, 100, 12, 11]; // 7 muestras, outlier incluido
    const readings = values.map((value) => readingAtHour(5, value));

    const baselines = service.calculate(readings);
    const hour5 = baselines.get('M-001')![5];

    expect(hour5.sampleCount).toBe(7);
    expect(hour5.isFallback).toBe(false);
    expect(hour5.median).toBe(12);
    // MAD = median(|x - 12|) sobre [2,0,1,1,88,0,1] ordenado [0,0,1,1,1,2,88] -> mediana = 1
    expect(hour5.mad).toBe(1);
  });

  it('cae a la mediana global del medidor cuando la hora tiene menos de 7 muestras', () => {
    const hourReadings = [readingAtHour(3, 20), readingAtHour(3, 22)]; // 2 muestras < 7
    const otherReadings = [
      readingAtHour(10, 40),
      readingAtHour(10, 42),
      readingAtHour(10, 44),
      readingAtHour(10, 46),
      readingAtHour(10, 48),
      readingAtHour(10, 50),
      readingAtHour(10, 52),
    ];
    const readings = [...hourReadings, ...otherReadings];

    const baselines = service.calculate(readings);
    const hour3 = baselines.get('M-001')![3];
    const globalValues = readings
      .map((r) => r.consumptionKwh)
      .sort((a, b) => a - b);
    const globalMedian = globalValues[Math.floor(globalValues.length / 2)];

    expect(hour3.sampleCount).toBe(2);
    expect(hour3.isFallback).toBe(true);
    expect(hour3.median).toBe(globalMedian);
  });

  it('calcula baselines independientes por medidor', () => {
    const readings = [
      readingAtHour(0, 10, 'M-001'),
      readingAtHour(0, 200, 'M-002'),
    ];

    const baselines = service.calculate(readings);

    expect(baselines.get('M-001')![0].median).toBe(10);
    expect(baselines.get('M-002')![0].median).toBe(200);
  });
});

import { Reading } from '../../readings/entities/reading.entity';
import { AnomalyDetectorRunnerService } from './anomaly-detector-runner.service';
import {
  AnomalousReadingInput,
  AnomalyGrouperService,
} from './anomaly-grouper.service';
import { HourlyBaseline } from './types';

function makeReading(
  timestamp: string,
  consumptionKwh: number,
  meterId = 'M-001',
): Reading {
  // voltage×current×powerFactor = consumptionKwh×1000 exactamente → nunca dispara ELECTRICAL_RELATION.
  return {
    meterId,
    timestamp,
    consumptionKwh,
    voltage: 200,
    current: consumptionKwh * 5,
    powerFactor: 1,
    status: 'OK',
  };
}

function flatBaseline(median: number, mad: number): HourlyBaseline[] {
  return Array.from({ length: 24 }, () => ({
    median,
    mad,
    sampleCount: 10,
    isFallback: false,
  }));
}

describe('AnomalyDetectorRunnerService', () => {
  it('corre los detectores por lectura y delega la agrupación, omitiendo medidores sin baseline', () => {
    const spikeReading = makeReading('2026-01-01T05:00:00.000Z', 59); // z = 0.6745*(59-50)/1 = 6.0705 > 5.5
    const normalReading = makeReading('2026-01-02T05:00:00.000Z', 52); // z = 0.6745*2/1 = 1.349, no dispara
    const otherMeterReading = makeReading(
      '2026-01-01T05:00:00.000Z',
      999,
      'M-002',
    );

    const readingsByMeter = new Map<string, Reading[]>([
      ['M-001', [spikeReading, normalReading]],
      ['M-002', [otherMeterReading]],
    ]);
    const baselines = new Map<string, HourlyBaseline[]>([
      ['M-001', flatBaseline(50, 1)],
      // M-002 no tiene entrada de baseline (simula 0 lecturas en la corrida real)
    ]);

    const group = jest.fn().mockReturnValue([]);
    const anomalyGrouper = { group } as unknown as AnomalyGrouperService;
    const runner = new AnomalyDetectorRunnerService(anomalyGrouper);

    runner.run(['M-001', 'M-002'], readingsByMeter, baselines, 4);

    expect(group).toHaveBeenCalledTimes(1);
    const [anomalousInputs, gapHoursArg] = group.mock.calls[0] as [
      AnomalousReadingInput[],
      number | undefined,
    ];
    expect(gapHoursArg).toBe(4);
    expect(anomalousInputs).toHaveLength(2); // solo M-001; M-002 se omite por falta de baseline

    const spikeInput = anomalousInputs.find(
      (input) => input.reading === spikeReading,
    );
    const normalInput = anomalousInputs.find(
      (input) => input.reading === normalReading,
    );

    if (!spikeInput || !normalInput) {
      throw new Error('expected both inputs to be present');
    }

    expect(spikeInput.baselineMedian).toBe(50);
    expect(spikeInput.signals).toEqual([
      { detector: 'Z_SCORE', value: 6.0705 },
    ]);
    expect(normalInput.signals).toEqual([]);
  });
});

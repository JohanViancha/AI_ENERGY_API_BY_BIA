import { EventsRepository } from '../../events/events.repository';
import { Reading } from '../../readings/entities/reading.entity';
import { ReadingsRepository } from '../../readings/readings.repository';
import { ReadingEventLoaderService } from './reading-event-loader.service';

function makeReading(timestamp: string, consumptionKwh = 50): Reading {
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

describe('ReadingEventLoaderService', () => {
  describe('loadReadings', () => {
    it('usa límites por defecto muy amplios cuando no se pasan from/to/windowDays', async () => {
      const findByMeterAndRange = jest.fn().mockResolvedValue([]);
      const readingsRepository = {
        findByMeterAndRange,
      } as unknown as ReadingsRepository;
      const eventsRepository = {} as EventsRepository;
      const service = new ReadingEventLoaderService(
        readingsRepository,
        eventsRepository,
      );

      await service.loadReadings(['M-001'], {});

      expect(findByMeterAndRange).toHaveBeenCalledWith(
        'M-001',
        expect.stringContaining('0001-01-01'),
        expect.stringContaining('9999-12-31'),
      );
    });

    it('usa from/to explícitos cuando se proveen', async () => {
      const findByMeterAndRange = jest.fn().mockResolvedValue([]);
      const readingsRepository = {
        findByMeterAndRange,
      } as unknown as ReadingsRepository;
      const eventsRepository = {} as EventsRepository;
      const service = new ReadingEventLoaderService(
        readingsRepository,
        eventsRepository,
      );

      await service.loadReadings(['M-001'], {
        from: '2026-01-01',
        to: '2026-01-31',
      });

      expect(findByMeterAndRange).toHaveBeenCalledWith(
        'M-001',
        '2026-01-01',
        '2026-01-31',
      );
    });

    it('filtra por windowDays en memoria cuando no hay from/to explícitos', async () => {
      const readings = [
        makeReading('2026-01-01T00:00:00.000Z'), // fuera de la ventana de 1 día
        makeReading('2026-01-04T00:00:00.000Z'), // dentro (justo el máximo)
        makeReading('2026-01-03T12:00:00.000Z'), // dentro (dentro de 1 día antes del máximo)
      ];
      const findByMeterAndRange = jest.fn().mockResolvedValue(readings);
      const readingsRepository = {
        findByMeterAndRange,
      } as unknown as ReadingsRepository;
      const eventsRepository = {} as EventsRepository;
      const service = new ReadingEventLoaderService(
        readingsRepository,
        eventsRepository,
      );

      const result = await service.loadReadings(['M-001'], { windowDays: 1 });

      expect(result.get('M-001')).toHaveLength(2);
      expect(result.get('M-001')?.map((r) => r.timestamp)).toEqual([
        '2026-01-04T00:00:00.000Z',
        '2026-01-03T12:00:00.000Z',
      ]);
    });

    it('ignora windowDays si se proveen from/to explícitos', async () => {
      const readings = [
        makeReading('2026-01-01T00:00:00.000Z'),
        makeReading('2026-01-10T00:00:00.000Z'),
      ];
      const findByMeterAndRange = jest.fn().mockResolvedValue(readings);
      const readingsRepository = {
        findByMeterAndRange,
      } as unknown as ReadingsRepository;
      const eventsRepository = {} as EventsRepository;
      const service = new ReadingEventLoaderService(
        readingsRepository,
        eventsRepository,
      );

      const result = await service.loadReadings(['M-001'], {
        from: '2026-01-01',
        to: '2026-01-10',
        windowDays: 1,
      });

      expect(result.get('M-001')).toHaveLength(2); // sin filtrar por windowDays
    });
  });

  describe('loadEvents', () => {
    it('consulta eventos por medidor con los límites por defecto', async () => {
      const findByMeterAndRange = jest.fn().mockResolvedValue([]);
      const eventsRepository = {
        findByMeterAndRange,
      } as unknown as EventsRepository;
      const readingsRepository = {} as ReadingsRepository;
      const service = new ReadingEventLoaderService(
        readingsRepository,
        eventsRepository,
      );

      const result = await service.loadEvents(['M-001', 'M-002'], {});

      expect(findByMeterAndRange).toHaveBeenCalledTimes(2);
      expect(result.has('M-001')).toBe(true);
      expect(result.has('M-002')).toBe(true);
    });
  });
});

import { AnalysesRepository } from '../../anomalies/analyses.repository';
import { AnomaliesRepository } from '../../anomalies/anomalies.repository';
import { Analysis } from '../../anomalies/entities/analysis.entity';
import { Anomaly } from '../../anomalies/entities/anomaly.entity';
import { MetersRepository } from '../../meters/meters.repository';
import { ReasonTemplateService } from '../explainer/reason-template.service';
import { AnomalyBuilderService } from './anomaly-builder.service';
import { AnomalyClassifierService } from './anomaly-classifier.service';
import { AnomalyDetectorRunnerService } from './anomaly-detector-runner.service';
import { AnomalyEngineService } from './anomaly-engine.service';
import { BaselineCalculatorService } from './baseline-calculator.service';
import { EventCorrelatorService } from './event-correlator.service';
import { ReadingEventLoaderService } from './reading-event-loader.service';
import { AnomalyCandidate } from './types';

function makeCandidate(): AnomalyCandidate {
  return {
    meterId: 'M-001',
    windowStart: '2026-01-01T05:00:00.000Z',
    windowEnd: '2026-01-01T05:00:00.000Z',
    readings: [],
    signals: [{ detector: 'Z_SCORE', value: 5 }],
    baselineMedian: 50,
    observedMedian: 100,
    variationPct: 100,
  };
}

function buildMocks(callOrder: string[]) {
  const finalAnalysis: Analysis = {
    id: 'analysis-1',
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: '2026-01-01T01:00:00.000Z',
    status: 'COMPLETED',
    errorCode: null,
    errorMessage: null,
    triggeredBy: 'MANUAL',
    metersAnalyzed: ['M-001'],
    progress: { phase: 'RECOMMENDATION', pct: 100 },
    anomaliesCount: 1,
    highPriorityCount: 0,
  };

  const builtAnomaly: Omit<Anomaly, 'id'> = {
    meterId: 'M-001',
    analysisId: 'analysis-1',
    detectedAt: '2026-01-01T00:00:00.000Z',
    type: 'REAL_ANOMALY',
    severity: 'HIGH',
    confidence: 0.6,
    priorityScore: 1.8,
    status: 'OPEN',
    reason: 'reason text',
    recommendedAction: 'action text',
    evidence: {
      baselineKwh: 50,
      observedKwh: 100,
      variationPct: 100,
      signals: ['Z_SCORE', 'NO_EVENT'],
      windowStart: '2026-01-01T05:00:00.000Z',
      windowEnd: '2026-01-01T05:00:00.000Z',
      relatedEvents: [],
      detectorScores: {
        Z_SCORE: 5,
        IQR_RESIDUAL: 0,
        VARIATION_PCT: 100,
        MAGNITUDE: 0.3,
        EVENT_CLARITY: 0.85,
        SIGNALS_COUNT: 1,
      },
    },
  };

  const listAll = jest.fn().mockImplementation(() => {
    callOrder.push('meters.listAll');
    return [{ meterId: 'M-001' }];
  });
  const loadReadings = jest.fn().mockImplementation(() => {
    callOrder.push('readingEventLoader.loadReadings');
    return new Map([['M-001', []]]);
  });
  const loadEvents = jest.fn().mockImplementation(() => {
    callOrder.push('readingEventLoader.loadEvents');
    return new Map([['M-001', []]]);
  });
  const create = jest.fn().mockImplementation(() => {
    callOrder.push('analyses.create');
    return 'analysis-1';
  });
  const updateProgress = jest
    .fn()
    .mockImplementation((_id: string, phase: string) => {
      callOrder.push(`analyses.updateProgress(${phase})`);
    });
  const finish = jest.fn().mockImplementation(() => {
    callOrder.push('analyses.finish');
  });
  const findById = jest.fn().mockResolvedValue(finalAnalysis);
  const createMany = jest.fn().mockImplementation(() => {
    callOrder.push('anomalies.createMany');
    return ['anomaly-1'];
  });
  const calculate = jest.fn().mockImplementation(() => {
    callOrder.push('baselineCalculator.calculate');
    return new Map();
  });
  const run = jest.fn().mockImplementation(() => {
    callOrder.push('detectorRunner.run');
    return [makeCandidate()];
  });
  const correlate = jest.fn().mockImplementation(() => {
    callOrder.push('eventCorrelator.correlate');
    return { coveragePct: 0, matchedEvents: [] };
  });
  const classify = jest.fn().mockImplementation(() => {
    callOrder.push('anomalyClassifier.classify');
    return { type: 'REAL_ANOMALY', severity: 'HIGH' };
  });
  const generateReason = jest.fn().mockImplementation(() => {
    callOrder.push('reasonTemplate.generate');
    return 'reason text';
  });
  const build = jest.fn().mockImplementation(() => {
    callOrder.push('anomalyBuilder.build');
    return builtAnomaly;
  });

  const metersRepository = { listAll } as unknown as MetersRepository;
  const readingEventLoader = {
    loadReadings,
    loadEvents,
  } as unknown as ReadingEventLoaderService;
  const analysesRepository = {
    create,
    updateProgress,
    finish,
    findById,
  } as unknown as AnalysesRepository;
  const anomaliesRepository = { createMany } as unknown as AnomaliesRepository;
  const baselineCalculator = {
    calculate,
  } as unknown as BaselineCalculatorService;
  const detectorRunner = { run } as unknown as AnomalyDetectorRunnerService;
  const eventCorrelator = { correlate } as unknown as EventCorrelatorService;
  const anomalyClassifier = { classify } as unknown as AnomalyClassifierService;
  const reasonTemplate = {
    generate: generateReason,
  } as unknown as ReasonTemplateService;
  const anomalyBuilder = { build } as unknown as AnomalyBuilderService;

  const engine = new AnomalyEngineService(
    metersRepository,
    readingEventLoader,
    analysesRepository,
    anomaliesRepository,
    baselineCalculator,
    detectorRunner,
    eventCorrelator,
    anomalyClassifier,
    reasonTemplate,
    anomalyBuilder,
  );

  return {
    engine,
    listAll,
    create,
    updateProgress,
    finish,
    createMany,
    run,
    finalAnalysis,
  };
}

describe('AnomalyEngineService (orquestación)', () => {
  it('ejecuta las 7 fases en orden y llama updateProgress exactamente 7 veces', async () => {
    const callOrder: string[] = [];
    const {
      engine,
      listAll,
      create,
      updateProgress,
      finish,
      createMany,
      finalAnalysis,
    } = buildMocks(callOrder);

    const result = await engine.runAnalysis({ meterIds: ['M-001'] });

    expect(listAll).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith({ metersAnalyzed: ['M-001'] });

    expect(updateProgress).toHaveBeenCalledTimes(7);
    const phasesCalled = updateProgress.mock.calls.map(
      (call: unknown[]) => call[1] as string,
    );
    expect(phasesCalled).toEqual([
      'READINGS',
      'BASELINE',
      'DETECTION',
      'CORRELATION',
      'EVENTS',
      'EXPLANATION',
      'RECOMMENDATION',
    ]);

    expect(callOrder).toEqual([
      'analyses.create',
      'readingEventLoader.loadReadings',
      'analyses.updateProgress(READINGS)',
      'baselineCalculator.calculate',
      'analyses.updateProgress(BASELINE)',
      'detectorRunner.run',
      'analyses.updateProgress(DETECTION)',
      'readingEventLoader.loadEvents',
      'eventCorrelator.correlate',
      'analyses.updateProgress(CORRELATION)',
      'anomalyClassifier.classify',
      'analyses.updateProgress(EVENTS)',
      'reasonTemplate.generate',
      'analyses.updateProgress(EXPLANATION)',
      'anomalyBuilder.build',
      'anomalies.createMany',
      'analyses.updateProgress(RECOMMENDATION)',
      'analyses.finish',
    ]);

    expect(createMany).toHaveBeenCalledTimes(1);
    expect(finish).toHaveBeenCalledWith(
      'analysis-1',
      'COMPLETED',
      null,
      null,
      1,
      1,
    );
    expect(result).toEqual(finalAnalysis);
  });

  it('usa MetersRepository.listAll() cuando no se especifican meterIds', async () => {
    const callOrder: string[] = [];
    const { engine, listAll, create } = buildMocks(callOrder);

    await engine.runAnalysis({});

    expect(listAll).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({ metersAnalyzed: ['M-001'] });
  });

  describe('manejo de errores', () => {
    it('si una fase lanza un Error, cierra el Analysis como FAILED con errorCode/errorMessage y re-lanza', async () => {
      const callOrder: string[] = [];
      const { engine, finish, createMany, run } = buildMocks(callOrder);

      const failure = new Error('boom');
      run.mockImplementation(() => {
        throw failure;
      });

      await expect(engine.runAnalysis({ meterIds: ['M-001'] })).rejects.toThrow(
        'boom',
      );

      expect(finish).toHaveBeenCalledWith(
        'analysis-1',
        'FAILED',
        'Error',
        'boom',
      );
      expect(finish).not.toHaveBeenCalledWith(
        'analysis-1',
        'COMPLETED',
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
      // las fases posteriores a DETECTION nunca deberían ejecutarse
      expect(createMany).not.toHaveBeenCalled();
    });

    it('si se lanza un valor que no es Error, usa errorCode=UNKNOWN_ERROR y el valor serializado como errorMessage', async () => {
      const callOrder: string[] = [];
      const { engine, finish, run } = buildMocks(callOrder);

      run.mockImplementation(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error -- se prueba deliberadamente el branch no-Error
        throw 'algo salió mal';
      });

      await expect(engine.runAnalysis({ meterIds: ['M-001'] })).rejects.toBe(
        'algo salió mal',
      );

      expect(finish).toHaveBeenCalledWith(
        'analysis-1',
        'FAILED',
        'UNKNOWN_ERROR',
        'algo salió mal',
      );
    });

    it('no llama finish(FAILED) si el error ocurre antes de crear el Analysis (create() falla)', async () => {
      const callOrder: string[] = [];
      const { engine, create, finish } = buildMocks(callOrder);
      create.mockRejectedValue(new Error('firestore down'));

      await expect(engine.runAnalysis({ meterIds: ['M-001'] })).rejects.toThrow(
        'firestore down',
      );

      expect(finish).not.toHaveBeenCalled();
    });
  });
});

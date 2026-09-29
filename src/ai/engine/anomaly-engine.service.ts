import { Injectable } from '@nestjs/common';
import { AnalysesRepository } from '../../anomalies/analyses.repository';
import { AnomaliesRepository } from '../../anomalies/anomalies.repository';
import { Analysis } from '../../anomalies/entities/analysis.entity';
import { MetersRepository } from '../../meters/meters.repository';
import { ReasonTemplateService } from '../explainer/reason-template.service';
import { AnomalyBuilderService } from './anomaly-builder.service';
import { AnomalyClassifierService } from './anomaly-classifier.service';
import { AnomalyDetectorRunnerService } from './anomaly-detector-runner.service';
import { buildEvidenceSignals } from './anomaly-evidence-builder';
import { BaselineCalculatorService } from './baseline-calculator.service';
import { EventCorrelatorService } from './event-correlator.service';
import { ReadingEventLoaderService } from './reading-event-loader.service';
import { RunAnalysisParams } from './types';

const PROGRESS_BY_PHASE = {
  READINGS: 10,
  BASELINE: 25,
  DETECTION: 45,
  CORRELATION: 60,
  EVENTS: 75,
  EXPLANATION: 90,
  RECOMMENDATION: 100,
} as const;

@Injectable()
export class AnomalyEngineService {
  constructor(
    private readonly metersRepository: MetersRepository,
    private readonly readingEventLoader: ReadingEventLoaderService,
    private readonly analysesRepository: AnalysesRepository,
    private readonly anomaliesRepository: AnomaliesRepository,
    private readonly baselineCalculator: BaselineCalculatorService,
    private readonly detectorRunner: AnomalyDetectorRunnerService,
    private readonly eventCorrelator: EventCorrelatorService,
    private readonly anomalyClassifier: AnomalyClassifierService,
    private readonly reasonTemplate: ReasonTemplateService,
    private readonly anomalyBuilder: AnomalyBuilderService,
  ) {}

  async runAnalysis(params: RunAnalysisParams): Promise<Analysis> {
    const meterIds =
      params.meterIds ??
      (await this.metersRepository.listAll()).map((meter) => meter.meterId);
    const analysisId = await this.analysesRepository.create({
      metersAnalyzed: meterIds,
    });

    try {
      await this.runPhases(analysisId, meterIds, params);
    } catch (error) {
      const errorCode = error instanceof Error ? error.name : 'UNKNOWN_ERROR';
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      await this.analysesRepository.finish(
        analysisId,
        'FAILED',
        errorCode,
        errorMessage,
      );
      throw error;
    }

    return (await this.analysesRepository.findById(analysisId)) as Analysis;
  }

  async startAnalysis(params: RunAnalysisParams): Promise<string> {
    const meterIds =
      params.meterIds ??
      (await this.metersRepository.listAll()).map((meter) => meter.meterId);
    const analysisId = await this.analysesRepository.create({
      metersAnalyzed: meterIds,
    });

    void this.runPhases(analysisId, meterIds, params).catch(async (error) => {
      const errorCode = error instanceof Error ? error.name : 'UNKNOWN_ERROR';
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      await this.analysesRepository.finish(
        analysisId,
        'FAILED',
        errorCode,
        errorMessage,
      );
    });

    return analysisId;
  }

  private async runPhases(
    analysisId: string,
    meterIds: string[],
    params: RunAnalysisParams,
  ): Promise<void> {
    // READINGS
    const readingsByMeter = await this.readingEventLoader.loadReadings(
      meterIds,
      params,
    );
    await this.analysesRepository.updateProgress(
      analysisId,
      'READINGS',
      PROGRESS_BY_PHASE.READINGS,
    );

    // BASELINE
    const allReadings = [...readingsByMeter.values()].flat();
    const baselines = this.baselineCalculator.calculate(allReadings);
    await this.analysesRepository.updateProgress(
      analysisId,
      'BASELINE',
      PROGRESS_BY_PHASE.BASELINE,
    );

    // DETECTION (detectores + agrupación en tramos)
    const candidates = this.detectorRunner.run(
      meterIds,
      readingsByMeter,
      baselines,
      params.gapHours,
    );
    await this.analysesRepository.updateProgress(
      analysisId,
      'DETECTION',
      PROGRESS_BY_PHASE.DETECTION,
    );

    // CORRELATION (eventos + cobertura)
    const eventsByMeter = await this.readingEventLoader.loadEvents(
      meterIds,
      params,
    );
    const correlations = candidates.map((candidate) =>
      this.eventCorrelator.correlate(
        candidate,
        eventsByMeter.get(candidate.meterId) ?? [],
      ),
    );
    await this.analysesRepository.updateProgress(
      analysisId,
      'CORRELATION',
      PROGRESS_BY_PHASE.CORRELATION,
    );

    // EVENTS (clasificación type/severity, pese al nombre de fase heredado de SPEC 01)
    const classifications = candidates.map((candidate, i) =>
      this.anomalyClassifier.classify(candidate, correlations[i].coveragePct),
    );
    await this.analysesRepository.updateProgress(
      analysisId,
      'EVENTS',
      PROGRESS_BY_PHASE.EVENTS,
    );

    // EXPLANATION (reason)
    const reasons = candidates.map((candidate, i) =>
      this.reasonTemplate.generate({
        type: classifications[i].type,
        meterId: candidate.meterId,
        windowStart: candidate.windowStart,
        windowEnd: candidate.windowEnd,
        variationPct: candidate.variationPct,
        signals: buildEvidenceSignals(
          candidate,
          correlations[i].matchedEvents.length > 0,
        ),
      }),
    );
    await this.analysesRepository.updateProgress(
      analysisId,
      'EXPLANATION',
      PROGRESS_BY_PHASE.EXPLANATION,
    );

    // RECOMMENDATION (recommendedAction + confidence + priorityScore + persistencia + cierre)
    const anomaliesToCreate = candidates.map((candidate, i) =>
      this.anomalyBuilder.build({
        analysisId,
        candidate,
        classification: classifications[i],
        correlation: correlations[i],
        reason: reasons[i],
        baselines,
      }),
    );
    await this.anomaliesRepository.createMany(anomaliesToCreate);
    await this.analysesRepository.updateProgress(
      analysisId,
      'RECOMMENDATION',
      PROGRESS_BY_PHASE.RECOMMENDATION,
    );

    const anomaliesCount = anomaliesToCreate.length;
    const highPriorityCount = anomaliesToCreate.filter(
      (anomaly) => anomaly.severity === 'HIGH',
    ).length;
    await this.analysesRepository.finish(
      analysisId,
      'COMPLETED',
      null,
      null,
      anomaliesCount,
      highPriorityCount,
    );
  }
}

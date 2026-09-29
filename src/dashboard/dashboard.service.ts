import { Injectable } from '@nestjs/common';
import { AnalysesRepository } from '../anomalies/analyses.repository';
import { AnomaliesRepository } from '../anomalies/anomalies.repository';
import type {
  Anomaly,
  AnomalySeverity,
} from '../anomalies/entities/anomaly.entity';

export interface DashboardSummary {
  analysisId: string | null;
  finishedAt: string | null;
  anomaliesCount: number;
  bySeverity: Record<AnomalySeverity, number>;
  byType: Record<string, number>;
  avgConfidence: number | null;
}

const EMPTY_SUMMARY: DashboardSummary = {
  analysisId: null,
  finishedAt: null,
  anomaliesCount: 0,
  bySeverity: { HIGH: 0, MEDIUM: 0, LOW: 0 },
  byType: {},
  avgConfidence: null,
};

@Injectable()
export class DashboardService {
  constructor(
    private readonly analysesRepository: AnalysesRepository,
    private readonly anomaliesRepository: AnomaliesRepository,
  ) {}

  async getSummary(): Promise<DashboardSummary> {
    const latestCompleted = await this.analysesRepository.findLatestCompleted();

    if (!latestCompleted) {
      return EMPTY_SUMMARY;
    }

    const anomalies = await this.anomaliesRepository.findByAnalysisId(
      latestCompleted.id,
    );

    return {
      analysisId: latestCompleted.id,
      finishedAt: latestCompleted.finishedAt,
      anomaliesCount: anomalies.length,
      bySeverity: DashboardService.countBySeverity(anomalies),
      byType: DashboardService.countByType(anomalies),
      avgConfidence: DashboardService.averageConfidence(anomalies),
    };
  }

  private static countBySeverity(
    anomalies: Anomaly[],
  ): Record<AnomalySeverity, number> {
    const counts: Record<AnomalySeverity, number> = {
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    };

    for (const anomaly of anomalies) {
      counts[anomaly.severity] += 1;
    }

    return counts;
  }

  private static countByType(anomalies: Anomaly[]): Record<string, number> {
    return anomalies.reduce<Record<string, number>>((counts, anomaly) => {
      counts[anomaly.type] = (counts[anomaly.type] ?? 0) + 1;
      return counts;
    }, {});
  }

  private static averageConfidence(anomalies: Anomaly[]): number | null {
    if (anomalies.length === 0) {
      return null;
    }

    const sum = anomalies.reduce(
      (total, anomaly) => total + anomaly.confidence,
      0,
    );
    return sum / anomalies.length;
  }
}

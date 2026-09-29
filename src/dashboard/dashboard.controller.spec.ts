import { DashboardController } from './dashboard.controller';
import type { DashboardService, DashboardSummary } from './dashboard.service';

describe('DashboardController', () => {
  it('delega en DashboardService.getSummary', async () => {
    const summary: DashboardSummary = {
      analysisId: 'analysis-1',
      finishedAt: '2026-01-01T01:00:00.000Z',
      anomaliesCount: 2,
      bySeverity: { HIGH: 1, MEDIUM: 0, LOW: 1 },
      byType: { REAL_ANOMALY: 2 },
      avgConfidence: 0.75,
    };
    const getSummary = jest.fn().mockResolvedValue(summary);
    const controller = new DashboardController({
      getSummary,
    } as unknown as DashboardService);

    const result = await controller.getSummary();

    expect(getSummary).toHaveBeenCalledTimes(1);
    expect(result).toEqual(summary);
  });
});

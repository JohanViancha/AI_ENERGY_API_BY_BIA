import {
  Analysis,
  AnalysisFirestoreDoc,
  fromFirestoreDoc,
  toFirestoreDoc,
} from './analysis.entity';

describe('Analysis mappers', () => {
  const analysis: Analysis = {
    id: 'analysis-123',
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: null,
    status: 'RUNNING',
    errorCode: null,
    errorMessage: null,
    triggeredBy: 'MANUAL',
    metersAnalyzed: ['M-001', 'M-002'],
    progress: { phase: 'BASELINE', pct: 20 },
    anomaliesCount: 0,
    highPriorityCount: 0,
  };

  const doc: AnalysisFirestoreDoc = {
    started_at: '2026-01-01T00:00:00.000Z',
    finished_at: null,
    status: 'RUNNING',
    error_code: null,
    error_message: null,
    triggered_by: 'MANUAL',
    meters_analyzed: ['M-001', 'M-002'],
    progress: { phase: 'BASELINE', pct: 20 },
    anomalies_count: 0,
    high_priority_count: 0,
  };

  it('converts an Analysis to its Firestore doc shape (camelCase -> snake_case, id excluded)', () => {
    expect(toFirestoreDoc(analysis)).toEqual(doc);
  });

  it('converts a Firestore doc back to an Analysis using the id passed separately', () => {
    expect(fromFirestoreDoc('analysis-123', doc)).toEqual(analysis);
  });
});

import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import {
  Analysis,
  AnalysisFirestoreDoc,
  AnalysisPhase,
  AnalysisStatus,
  AnalysisTriggeredBy,
  fromFirestoreDoc,
} from './entities/analysis.entity';

const COLLECTION = 'analyses';

export interface CreateAnalysisParams {
  metersAnalyzed: string[];
  triggeredBy?: AnalysisTriggeredBy; // default 'MANUAL'
}

@Injectable()
export class AnalysesRepository {
  constructor(private readonly firebaseService: FirebaseService) {}

  async findById(analysisId: string): Promise<Analysis | null> {
    const doc = await this.firebaseService
      .getFirestore()
      .collection(COLLECTION)
      .doc(analysisId)
      .get();

    if (!doc.exists) {
      return null;
    }

    return fromFirestoreDoc(doc.id, doc.data() as AnalysisFirestoreDoc);
  }

  async create(params: CreateAnalysisParams): Promise<string> {
    const doc: AnalysisFirestoreDoc = {
      started_at: new Date().toISOString(),
      finished_at: null,
      status: 'RUNNING',
      error_code: null,
      error_message: null,
      triggered_by: params.triggeredBy ?? 'MANUAL',
      meters_analyzed: params.metersAnalyzed,
      progress: { phase: 'READINGS', pct: 0 },
      anomalies_count: 0,
      high_priority_count: 0,
    };

    const docRef = await this.firebaseService
      .getFirestore()
      .collection(COLLECTION)
      .add(doc);

    return docRef.id;
  }

  async updateProgress(
    analysisId: string,
    phase: AnalysisPhase,
    pct: number,
  ): Promise<void> {
    await this.firebaseService
      .getFirestore()
      .collection(COLLECTION)
      .doc(analysisId)
      .update({ progress: { phase, pct } });
  }

  async finish(
    analysisId: string,
    status: AnalysisStatus,
    errorCode: string | null = null,
    errorMessage: string | null = null,
    anomaliesCount?: number,
    highPriorityCount?: number,
  ): Promise<void> {
    const update: Partial<AnalysisFirestoreDoc> = {
      status,
      finished_at: new Date().toISOString(),
      error_code: errorCode,
      error_message: errorMessage,
    };

    if (anomaliesCount !== undefined) {
      update.anomalies_count = anomaliesCount;
    }
    if (highPriorityCount !== undefined) {
      update.high_priority_count = highPriorityCount;
    }

    await this.firebaseService
      .getFirestore()
      .collection(COLLECTION)
      .doc(analysisId)
      .update(update);
  }
}

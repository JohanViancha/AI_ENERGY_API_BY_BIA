import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import {
  Anomaly,
  AnomalyFirestoreDoc,
  fromFirestoreDoc,
} from './entities/anomaly.entity';

const COLLECTION = 'anomalies';

@Injectable()
export class AnomaliesRepository {
  constructor(private readonly firebaseService: FirebaseService) {}

  async findByAnalysisId(analysisId: string): Promise<Anomaly[]> {
    const snapshot = await this.firebaseService
      .getFirestore()
      .collection(COLLECTION)
      .where('analysis_id', '==', analysisId)
      .orderBy('priority_score', 'desc')
      .get();

    return snapshot.docs.map((doc) =>
      fromFirestoreDoc(doc.id, doc.data() as AnomalyFirestoreDoc),
    );
  }

  async findByMeter(meterId: string): Promise<Anomaly[]> {
    const snapshot = await this.firebaseService
      .getFirestore()
      .collection(COLLECTION)
      .where('meter_id', '==', meterId)
      .orderBy('detected_at', 'desc')
      .get();

    return snapshot.docs.map((doc) =>
      fromFirestoreDoc(doc.id, doc.data() as AnomalyFirestoreDoc),
    );
  }
}

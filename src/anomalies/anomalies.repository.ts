import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import {
  Anomaly,
  AnomalyFirestoreDoc,
  fromFirestoreDoc,
  toFirestoreDoc,
} from './entities/anomaly.entity';

const COLLECTION = 'anomalies';

@Injectable()
export class AnomaliesRepository {
  constructor(private readonly firebaseService: FirebaseService) {}

  async createMany(anomalies: Array<Omit<Anomaly, 'id'>>): Promise<string[]> {
    if (anomalies.length === 0) {
      return [];
    }

    const firestore = this.firebaseService.getFirestore();
    const collectionRef = firestore.collection(COLLECTION);
    const batch = firestore.batch();
    const ids: string[] = [];

    for (const anomaly of anomalies) {
      const docRef = collectionRef.doc();
      batch.set(docRef, toFirestoreDoc({ ...anomaly, id: docRef.id }));
      ids.push(docRef.id);
    }

    await batch.commit();

    return ids;
  }

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

import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import {
  Analysis,
  AnalysisFirestoreDoc,
  fromFirestoreDoc,
} from './entities/analysis.entity';

const COLLECTION = 'analyses';

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
}

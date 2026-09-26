import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import {
  fromFirestoreDoc,
  Reading,
  ReadingFirestoreDoc,
} from './entities/reading.entity';

const COLLECTION = 'readings';

@Injectable()
export class ReadingsRepository {
  constructor(private readonly firebaseService: FirebaseService) {}

  async findByMeterAndRange(
    meterId: string,
    from: string,
    to: string,
  ): Promise<Reading[]> {
    const snapshot = await this.firebaseService
      .getFirestore()
      .collection(COLLECTION)
      .where('meter_id', '==', meterId)
      .where('timestamp', '>=', from)
      .where('timestamp', '<=', to)
      .orderBy('timestamp', 'asc')
      .get();

    return snapshot.docs.map((doc) =>
      fromFirestoreDoc(doc.data() as ReadingFirestoreDoc),
    );
  }
}

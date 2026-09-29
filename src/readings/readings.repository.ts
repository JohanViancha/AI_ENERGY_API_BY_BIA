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

  async findLatestByMeter(meterId: string): Promise<Reading | null> {
    const snapshot = await this.firebaseService
      .getFirestore()
      .collection(COLLECTION)
      .where('meter_id', '==', meterId)
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();

    if (snapshot.docs.length === 0) {
      return null;
    }

    return fromFirestoreDoc(snapshot.docs[0].data() as ReadingFirestoreDoc);
  }

  async countByMeter(meterId: string): Promise<number> {
    const snapshot = await this.firebaseService
      .getFirestore()
      .collection(COLLECTION)
      .where('meter_id', '==', meterId)
      .count()
      .get();

    return snapshot.data().count;
  }

  async findByMeterPaginated(
    meterId: string,
    from: string,
    to: string,
    limit: number,
    cursor?: string,
  ): Promise<{ data: Reading[]; nextCursor: string | null }> {
    const lowerBound = cursor ?? from;

    const snapshot = await this.firebaseService
      .getFirestore()
      .collection(COLLECTION)
      .where('meter_id', '==', meterId)
      .where('timestamp', cursor ? '>' : '>=', lowerBound)
      .where('timestamp', '<=', to)
      .orderBy('timestamp', 'asc')
      .limit(limit + 1)
      .get();

    const hasNextPage = snapshot.docs.length > limit;
    const pageDocs = hasNextPage
      ? snapshot.docs.slice(0, limit)
      : snapshot.docs;
    const data = pageDocs.map((doc) =>
      fromFirestoreDoc(doc.data() as ReadingFirestoreDoc),
    );

    return {
      data,
      nextCursor: hasNextPage ? data[data.length - 1].timestamp : null,
    };
  }
}

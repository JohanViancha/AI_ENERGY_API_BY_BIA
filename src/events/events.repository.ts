import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import {
  fromFirestoreDoc,
  OperationalEvent,
  OperationalEventFirestoreDoc,
} from './entities/operational-event.entity';

const COLLECTION = 'events';

@Injectable()
export class EventsRepository {
  constructor(private readonly firebaseService: FirebaseService) {}

  async findByMeterAndRange(
    meterId: string,
    from: string,
    to: string,
  ): Promise<OperationalEvent[]> {
    const firestore = this.firebaseService.getFirestore();

    const snapshot = await firestore
      .collection(COLLECTION)
      .where('meter_id', '==', meterId)
      .where('event_timestamp', '>=', from)
      .where('event_timestamp', '<=', to)
      .get();

    return snapshot.docs
      .map((doc) =>
        fromFirestoreDoc(doc.data() as OperationalEventFirestoreDoc),
      )
      .sort((a, b) => a.eventTimestamp.localeCompare(b.eventTimestamp));
  }
}

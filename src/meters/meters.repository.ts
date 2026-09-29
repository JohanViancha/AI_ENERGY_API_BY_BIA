import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import {
  fromFirestoreDoc,
  Meter,
  MeterFirestoreDoc,
} from './entities/meter.entity';

const COLLECTION = 'meters';

@Injectable()
export class MetersRepository {
  constructor(private readonly firebaseService: FirebaseService) {}

  async listAll(): Promise<Meter[]> {
    const snapshot = await this.firebaseService
      .getFirestore()
      .collection(COLLECTION)
      .get();

    return snapshot.docs.map((doc) =>
      fromFirestoreDoc(doc.data() as MeterFirestoreDoc),
    );
  }

  async findById(meterId: string): Promise<Meter | null> {
    const doc = await this.firebaseService
      .getFirestore()
      .collection(COLLECTION)
      .doc(meterId)
      .get();

    if (!doc.exists) {
      return null;
    }

    return fromFirestoreDoc(doc.data() as MeterFirestoreDoc);
  }
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService {
  private readonly app: admin.app.App;

  constructor(private readonly configService: ConfigService) {
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = FirebaseService.normalizePrivateKey(
      this.configService.get<string>('FIREBASE_PRIVATE_KEY'),
    );

    this.app = admin.apps.length
      ? (admin.apps[0] as admin.app.App)
      : admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
  }

  getFirestore(): admin.firestore.Firestore {
    return this.app.firestore();
  }

  getAuth(): admin.auth.Auth {
    return this.app.auth();
  }

  // Normaliza formas comunes en que FIREBASE_PRIVATE_KEY llega mal formada desde .env:
  // comillas envolventes sin quitar, \n escapados sin convertir, o CRLF de Windows.
  private static normalizePrivateKey(
    rawPrivateKey?: string,
  ): string | undefined {
    if (!rawPrivateKey) {
      return rawPrivateKey;
    }

    let privateKey = rawPrivateKey.trim();

    if (
      (privateKey.startsWith('"') && privateKey.endsWith('"')) ||
      (privateKey.startsWith("'") && privateKey.endsWith("'"))
    ) {
      privateKey = privateKey.slice(1, -1);
    }

    return privateKey
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\r\n/g, '\n')
      .trim();
  }
}

import { ServiceUnavailableException } from '@nestjs/common';
import type { FirebaseService } from '../firebase/firebase.service';
import { HealthController } from './health.controller';

function createController(listCollections: jest.Mock) {
  const firebaseService = {
    getFirestore: () => ({ listCollections }),
  } as unknown as FirebaseService;
  return new HealthController(firebaseService);
}

describe('HealthController', () => {
  it('reports liveness without touching Firestore', () => {
    const listCollections = jest.fn();
    expect(createController(listCollections).liveness()).toEqual({
      status: 'ok',
    });
    expect(listCollections).not.toHaveBeenCalled();
  });

  it('reports ready when Firestore responds', async () => {
    const controller = createController(jest.fn().mockResolvedValue([]));
    await expect(controller.readiness()).resolves.toEqual({ status: 'ok' });
  });

  it('returns 503 when Firestore is unreachable', async () => {
    const controller = createController(
      jest.fn().mockRejectedValue(new Error('down')),
    );
    await expect(controller.readiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { FirebaseService } from '../src/firebase/firebase.service';
import { HealthModule } from '../src/health/health.module';
import { AuthModule } from '../src/auth/auth.module';
import { MetersModule } from '../src/meters/meters.module';

describe('HTTP surface (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const firebaseServiceStub = {
      getAuth: () => ({
        verifyIdToken: jest.fn().mockRejectedValue(new Error('invalid')),
      }),
      getFirestore: () => ({
        listCollections: jest.fn().mockResolvedValue([]),
      }),
    };
    const moduleFixture = await Test.createTestingModule({
      imports: [HealthModule, AuthModule, MetersModule],
    })
      .overrideProvider(FirebaseService)
      .useValue(firebaseServiceStub)
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health responds 200 without authentication', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
  });

  it('GET /health/ready responds 200 when Firestore is reachable', async () => {
    await request(app.getHttpServer()).get('/health/ready').expect(200);
  });

  it('GET /meters responds 401 without a bearer token', async () => {
    await request(app.getHttpServer()).get('/meters').expect(401);
  });

  it('GET /meters responds 401 with an invalid token', async () => {
    await request(app.getHttpServer())
      .get('/meters')
      .set('Authorization', 'Bearer nope')
      .expect(401);
  });
});

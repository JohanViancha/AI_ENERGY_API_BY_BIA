import { validateEnv } from './env.validation';

const validEnv = {
  FIREBASE_PROJECT_ID: 'project',
  FIREBASE_CLIENT_EMAIL: 'svc@project.iam.gserviceaccount.com',
  FIREBASE_PRIVATE_KEY: 'key',
};

describe('validateEnv', () => {
  it('accepts a config with all required variables', () => {
    expect(validateEnv(validEnv)).toEqual(validEnv);
  });

  it('throws listing the missing Firebase variables', () => {
    expect(() => validateEnv({})).toThrow(
      'FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY',
    );
  });

  it('throws when PORT is not an integer', () => {
    expect(() => validateEnv({ ...validEnv, PORT: 'abc' })).toThrow('PORT');
  });

  it('requires CORS_ORIGIN in production', () => {
    expect(() => validateEnv({ ...validEnv, NODE_ENV: 'production' })).toThrow(
      'CORS_ORIGIN',
    );
  });
});

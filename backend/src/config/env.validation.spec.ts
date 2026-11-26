import { describe, expect, it } from 'vitest';
import { LogLevel, NodeEnv, validateEnv } from './env.validation.js';

const validEnv = {
  NODE_ENV: NodeEnv.Development,
  MONGODB_URI: 'mongodb://127.0.0.1:27017/auth',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
  APP_ORIGIN: 'http://localhost:3000',
};

describe('validateEnv', () => {
  it('applies the closed defaults', () => {
    expect(validateEnv(validEnv)).toMatchObject({
      HOST: '127.0.0.1',
      PORT: 4000,
      ACCESS_TOKEN_TTL_SECONDS: 900,
      TRUST_PROXY_HOPS: 0,
      LOG_LEVEL: LogLevel.Info,
    });
  });

  it('parses a custom ACCESS_TOKEN_TTL_SECONDS', () => {
    expect(
      validateEnv({ ...validEnv, ACCESS_TOKEN_TTL_SECONDS: '60' })
        .ACCESS_TOKEN_TTL_SECONDS,
    ).toBe(60);
  });

  it('normalises APP_ORIGIN to a bare origin', () => {
    expect(
      validateEnv({ ...validEnv, APP_ORIGIN: 'http://localhost:3000/' })
        .APP_ORIGIN,
    ).toBe('http://localhost:3000');
  });

  it.each([
    ['a missing NODE_ENV', { NODE_ENV: undefined }],
    ['an empty JWT_ACCESS_SECRET', { JWT_ACCESS_SECRET: '' }],
  ])('rejects %s', (_case, override) => {
    expect(() => validateEnv({ ...validEnv, ...override })).toThrow(
      /Invalid environment/,
    );
  });
});

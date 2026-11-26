import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  SIGN_IN_PER_EMAIL_LIMIT,
  STRICT_LIMITS,
  ThrottlerName,
} from '../src/common/throttling.js';
import {
  createTestApp,
  HttpErrorName,
  path,
  type TestApp,
} from './test-app.js';

const PER_EMAIL_LIMIT = SIGN_IN_PER_EMAIL_LIMIT.limit;
const PER_IP_SIGN_IN_LIMIT = STRICT_LIMITS.signIn[ThrottlerName.Default].limit;

let t: TestApp;

const signInFrom = (ip: string, email: string) =>
  t
    .http()
    .post(path.signIn)
    .set('X-Forwarded-For', ip)
    .send({ email, password: 'Wrong#password1' });

beforeAll(async () => {
  t = await createTestApp({ throttling: true, trustProxyHops: 1 });
});

afterAll(async () => {
  await t.close();
});

describe('sign-in throttling', () => {
  it('limits attempts per email address even when every attempt comes from a different IP', async () => {
    const email = 'target@example.com';
    for (let attempt = 1; attempt <= PER_EMAIL_LIMIT; attempt++) {
      await signInFrom(`198.51.100.${attempt}`, email).expect(401);
    }

    const blocked = await signInFrom(
      '198.51.100.99',
      ` ${email.toUpperCase()}`,
    );

    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      statusCode: 429,
      error: HttpErrorName.TooManyRequests,
      message: expect.any(String),
    });
    await signInFrom('198.51.100.99', 'someone-else@example.com').expect(401);
  });

  it('limits attempts per client IP taken from X-Forwarded-For', async () => {
    const ip = '203.0.113.7';
    for (let attempt = 1; attempt <= PER_IP_SIGN_IN_LIMIT; attempt++) {
      await signInFrom(ip, `ip-user${attempt}@example.com`).expect(401);
    }

    await signInFrom(ip, 'ip-user-last@example.com').expect(429);
    await signInFrom('203.0.113.8', 'ip-user-last@example.com').expect(401);
  });
});

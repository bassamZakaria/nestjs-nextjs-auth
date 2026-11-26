import { afterAll, beforeAll, describe, it } from 'vitest';
import { STRICT_LIMITS, ThrottlerName } from '../src/common/throttling.js';
import { createTestApp, path, type TestApp } from './test-app.js';

const PER_IP_SIGN_IN_LIMIT = STRICT_LIMITS.signIn[ThrottlerName.Default].limit;

let t: TestApp;

beforeAll(async () => {
  t = await createTestApp({ throttling: true, trustProxyHops: 0 });
});

afterAll(async () => {
  await t.close();
});

describe('sign-in throttling without a trusted proxy', () => {
  it('ignores a spoofed X-Forwarded-For and keys on the connecting address', async () => {
    const signInAs = (attempt: number) =>
      t
        .http()
        .post(path.signIn)
        .set('X-Forwarded-For', `198.51.100.${attempt}`)
        .send({
          email: `spoof${attempt}@example.com`,
          password: 'Wrong#password1',
        });

    for (let attempt = 1; attempt <= PER_IP_SIGN_IN_LIMIT; attempt++) {
      await signInAs(attempt).expect(401);
    }

    await signInAs(PER_IP_SIGN_IN_LIMIT + 1).expect(429);
  });
});

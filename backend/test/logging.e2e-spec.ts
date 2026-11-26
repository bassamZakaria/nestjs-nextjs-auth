import { expect, it, vi } from 'vitest';
import { CookieName } from '../src/auth/auth-cookies.js';
import { LogLevel } from '../src/config/env.validation.js';
import { cookieValue, createTestApp, path } from './test-app.js';

it('keeps auth tokens out of the request logs', async () => {
  const write = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation(() => true);
  const t = await createTestApp({ logLevel: LogLevel.Info });
  const signedUp = await t.http().post(path.signUp).send({
    email: 'logs@example.com',
    name: 'Ada Lovelace',
    password: 'Analytical#1',
  });
  const access = cookieValue(signedUp, CookieName.Access) ?? '';
  const refresh = cookieValue(signedUp, CookieName.Refresh) ?? '';

  await t
    .http()
    .get(path.me)
    .set(
      'Cookie',
      `${CookieName.Access}=${access}; ${CookieName.Refresh}=${refresh}`,
    )
    .expect(200);
  await t.close();
  const output = write.mock.calls.map(([chunk]) => String(chunk)).join('');
  write.mockRestore();

  expect(output).toContain(path.me);
  expect(output).not.toContain(access);
  expect(output).not.toContain(refresh);
});

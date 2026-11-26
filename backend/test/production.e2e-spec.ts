import { CookieName } from '../src/auth/auth-cookies.js';
import { NodeEnv } from '../src/config/env.validation.js';
import { createTestApp, path, setCookie, type TestApp } from './test-app.js';

let t: TestApp;

beforeAll(async () => {
  t = await createTestApp({ nodeEnv: NodeEnv.Production });
});

afterAll(async () => {
  await t.close();
});

describe('production mode', () => {
  it('uses __Host- cookie names with the Secure flag', async () => {
    const response = await t
      .http()
      .post(path.signUp)
      .send({
        email: 'prod@example.com',
        name: 'Ada Lovelace',
        password: 'Analytical#1',
      })
      .expect(201);

    for (const name of [CookieName.HostAccess, CookieName.HostRefresh]) {
      expect(setCookie(response, name)).toMatch(
        /; Path=\/;.*; HttpOnly; Secure; SameSite=Strict/,
      );
    }
    expect(setCookie(response, CookieName.Access)).toBeUndefined();
  });

  it('does not serve the API docs', async () => {
    await t.http().get(path.docs).expect(404);
  });
});

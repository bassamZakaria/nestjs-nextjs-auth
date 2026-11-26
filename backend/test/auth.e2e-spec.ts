import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  ACCESS_TOKEN_AUDIENCE,
  ACCESS_TOKEN_ISSUER,
} from '../src/auth/access-token.js';
import { CookieName } from '../src/auth/auth-cookies.js';
import { AuthErrorMessage } from '../src/auth/auth.service.js';
import { PasswordRuleMessage } from '../src/auth/dto/credentials.js';
import { PasswordHasher } from '../src/auth/password-hasher.service.js';
import { ErrorMessage } from '../src/common/all-exceptions.filter.js';
import { UsersErrorMessage, UsersService } from '../src/users/users.service.js';
import {
  APP_ORIGIN,
  cookieValue,
  createTestApp,
  HttpErrorName,
  path,
  setCookie,
  type TestApp,
} from './test-app.js';

const PASSWORD = 'Analytical#1';

let t: TestApp;
let emailCounter = 0;
const uniqueEmail = () => `user${++emailCounter}@example.com`;

const signUp = (email = uniqueEmail(), name = 'Ada Lovelace') =>
  t.http().post(path.signUp).send({ email, name, password: PASSWORD });

const signIn = (email: string, password = PASSWORD) =>
  t.http().post(path.signIn).send({ email, password });

const refreshWith = (refreshToken: string, accessToken = '') =>
  t
    .http()
    .post(path.refresh)
    .set(
      'Cookie',
      `${CookieName.Refresh}=${refreshToken}; ${CookieName.Access}=${accessToken}`,
    );

const logoutWith = (refreshToken: string) =>
  t
    .http()
    .post(path.logout)
    .set('Cookie', `${CookieName.Refresh}=${refreshToken}`);

const sessionCount = (refreshToken: string) =>
  t.sessions.countDocuments({ _id: refreshToken.split('.')[0] });

const meWith = (accessToken: string) =>
  t.http().get(path.me).set('Cookie', `${CookieName.Access}=${accessToken}`);

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

const maxAgeOf = (cookie: string | undefined) =>
  Number(/Max-Age=(\d+)/.exec(cookie ?? '')?.[1]);

const tokensOf = (response: Response) => ({
  access: cookieValue(response, CookieName.Access) ?? '',
  refresh: cookieValue(response, CookieName.Refresh) ?? '',
});

const expectClearedCookies = (response: Response) => {
  for (const name of [CookieName.Access, CookieName.Refresh]) {
    expect(setCookie(response, name)).toMatch(
      new RegExp(`^${name}=;.*Expires=Thu, 01 Jan 1970`),
    );
  }
};

const unauthorized = {
  statusCode: 401,
  error: HttpErrorName.Unauthorized,
  message: HttpErrorName.Unauthorized,
};

beforeAll(async () => {
  t = await createTestApp();
});

afterAll(async () => {
  await t.close();
});

describe('POST /api/auth/signup', () => {
  it('creates the user, sets both cookies and returns only id, email and name', async () => {
    const response = await signUp('  Ada@Example.COM ', '  Ada Lovelace  ');

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.stringMatching(/^[0-9a-f]{24}$/),
      email: 'ada@example.com',
      name: 'Ada Lovelace',
    });
    const access = setCookie(response, CookieName.Access);
    const refresh = setCookie(response, CookieName.Refresh);
    expect(maxAgeOf(access)).toBe(15 * 60);
    expect(maxAgeOf(refresh)).toBeGreaterThan(SEVEN_DAYS_SECONDS - 10);
    expect(maxAgeOf(refresh)).toBeLessThanOrEqual(SEVEN_DAYS_SECONDS);
    for (const cookie of [access, refresh]) {
      expect(cookie).toMatch(/; Path=\/;/);
      expect(cookie).toMatch(/; HttpOnly/);
      expect(cookie).toMatch(/; SameSite=Strict/);
      expect(cookie).not.toMatch(/Secure|Domain/);
    }
    expect(JSON.stringify(response.body)).not.toMatch(/argon2|passwordHash/);
  });

  it('stores an argon2id hash with the OWASP minimum parameters, never the password', async () => {
    const email = uniqueEmail();
    await signUp(email).expect(201);

    const stored = await t.users
      .findOne({ email })
      .select('+passwordHash')
      .lean();
    expect(stored?.passwordHash).toMatch(
      /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/,
    );
    expect(stored?.passwordHash).not.toContain(PASSWORD);
  });

  it.each([
    ['an invalid email', { email: 'not-an-email' }, 'email must be an email'],
    [
      'an email over 254 characters',
      { email: `${'a'.repeat(250)}@x.io` },
      'email must be shorter than or equal to 254 characters',
    ],
    [
      'a name under 3 characters after trimming',
      { name: '  ab  ' },
      'name must be longer than or equal to 3 characters',
    ],
    [
      'a name over 100 characters',
      { name: 'a'.repeat(101) },
      'name must be shorter than or equal to 100 characters',
    ],
    [
      'a password under 8 characters',
      { password: 'Ab#1' },
      'password must be longer than or equal to 8 characters',
    ],
    [
      'a password over 128 characters',
      { password: `Ab#1${'a'.repeat(125)}` },
      'password must be shorter than or equal to 128 characters',
    ],
    [
      'a password without a letter',
      { password: '1234567#' },
      PasswordRuleMessage.Letter,
    ],
    [
      'a password without a number',
      { password: 'Abcdefg#' },
      PasswordRuleMessage.Digit,
    ],
    [
      'a password whose only non-alphanumeric is whitespace',
      { password: 'Abcdef 12' },
      PasswordRuleMessage.Special,
    ],
    ['a non-string name', { name: 12345 }, 'name must be a string'],
    ['an unknown field', { role: 'admin' }, 'property role should not exist'],
  ])('rejects %s with 400', async (_case, override, message) => {
    const response = await t
      .http()
      .post(path.signUp)
      .send({
        email: uniqueEmail(),
        name: 'Ada Lovelace',
        password: PASSWORD,
        ...override,
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      statusCode: 400,
      error: HttpErrorName.BadRequest,
      message: expect.arrayContaining([message]),
    });
    expect(setCookie(response, CookieName.Access)).toBeUndefined();
  });

  it('accepts a password with a non-Latin letter and a symbol', async () => {
    await t
      .http()
      .post(path.signUp)
      .send({
        email: uniqueEmail(),
        name: 'Ada Lovelace',
        password: 'пароль12€',
      })
      .expect(201);
  });

  it('answers 409 for an email that is already registered, ignoring case', async () => {
    const email = uniqueEmail();
    await signUp(email).expect(201);

    const response = await signUp(email.toUpperCase());

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      statusCode: 409,
      error: HttpErrorName.Conflict,
      message: UsersErrorMessage.EmailTaken,
    });
  });

  it('lets exactly one of two concurrent sign-ups with the same email succeed', async () => {
    const email = uniqueEmail();

    const statuses = (await Promise.all([signUp(email), signUp(email)])).map(
      (r) => r.status,
    );

    expect(statuses.sort((a, b) => a - b)).toEqual([201, 409]);
  });

  it('rejects a Mongo operator object in place of a string with 400', async () => {
    const response = await t
      .http()
      .post(path.signUp)
      .send({ email: { $ne: null }, name: 'Ada Lovelace', password: PASSWORD });

    expect(response.status).toBe(400);
  });
});

describe('POST /api/auth/signin', () => {
  let email: string;

  beforeAll(async () => {
    email = uniqueEmail();
    await signUp(email).expect(201);
  });

  it('signs in with a normalised email, sets both cookies and returns the user', async () => {
    const response = await signIn(`  ${email.toUpperCase()} `);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: expect.any(String),
      email,
      name: 'Ada Lovelace',
    });
    expect(tokensOf(response).access).not.toBe('');
    expect(tokensOf(response).refresh).not.toBe('');
  });

  it('returns the same 401 body for a wrong password and for an unknown email', async () => {
    const wrongPassword = await signIn(email, 'Wrong#password1');
    const unknownEmail = await signIn('nobody@example.com');

    const expected = {
      statusCode: 401,
      error: HttpErrorName.Unauthorized,
      message: AuthErrorMessage.InvalidCredentials,
    };
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body).toEqual(expected);
    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body).toEqual(expected);
    expect(setCookie(unknownEmail, CookieName.Access)).toBeUndefined();
  });

  it('still verifies a password hash when the email is unknown', async () => {
    const verify = vi.spyOn(t.app.get(PasswordHasher), 'verify');

    await signIn('nobody@example.com').expect(401);

    expect(verify).toHaveBeenCalledTimes(1);
    verify.mockRestore();
  });

  it.each([
    ['email', { email: { $ne: null }, password: 'x' }],
    ['password', { email: 'a@example.com', password: { $ne: null } }],
  ])('rejects an operator object as the %s with 400', async (_field, body) => {
    const response = await t.http().post(path.signIn).send(body);

    expect(response.status).toBe(400);
    expect(response.body.statusCode).toBe(400);
  });

  it('rejects a malformed email with 400', async () => {
    const response = await signIn('not-an-email');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      statusCode: 400,
      error: HttpErrorName.BadRequest,
      message: expect.arrayContaining(['email must be an email']),
    });
  });

  it('rejects an empty password with 400 and skips the complexity rules', async () => {
    const empty = await t
      .http()
      .post(path.signIn)
      .send({ email, password: '' });
    const simple = await signIn(email, 'simple');

    expect(empty.status).toBe(400);
    expect(simple.status).toBe(401);
  });

  it('keeps sessions from separate sign-ins independent', async () => {
    const first = tokensOf(await signIn(email));
    const second = tokensOf(await signIn(email));

    await t
      .http()
      .post(path.logout)
      .set('Cookie', `${CookieName.Refresh}=${first.refresh}`)
      .expect(204);

    await refreshWith(first.refresh).expect(401);
    await refreshWith(second.refresh).expect(200);
  });
});

describe('global auth guard', () => {
  it('answers 401 on GET /api/users/me without a cookie', async () => {
    const response = await t.http().get(path.me);

    expect(response.status).toBe(401);
    expect(response.body).toEqual(unauthorized);
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('returns the current user from the access cookie only', async () => {
    const signedUp = await signUp();

    const response = await meWith(tokensOf(signedUp).access).query({
      id: 'someone-else',
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(signedUp.body);
  });

  it('protects a route that has no decorator at all', async () => {
    const { access } = tokensOf(await signUp());

    await t.http().get(path.probe).expect(401);
    await t
      .http()
      .get(path.probe)
      .set('Cookie', `${CookieName.Access}=${access}`)
      .expect(200);
  });

  describe('rejects forged or invalid access tokens', () => {
    let userId: string;
    let sessionId: string;
    let jwt: JwtService;

    beforeAll(async () => {
      const signedUp = await signUp();
      userId = signedUp.body.id;
      sessionId = tokensOf(signedUp).refresh.split('.')[0];
      jwt = t.app.get(JwtService);
    });

    const sign = (options: Parameters<JwtService['sign']>[1]) =>
      jwt.sign({ sub: userId, sid: sessionId }, options);

    it('accepts a correctly signed token, as a control', async () => {
      await meWith(sign({})).expect(200);
    });

    it.each([
      ['a different algorithm (HS512)', { algorithm: 'HS512' as const }],
      ['a wrong issuer', { issuer: 'someone-else' }],
      ['a wrong audience', { audience: 'someone-else' }],
      ['a different secret', { secret: 'x'.repeat(48) }],
      ['an expired token', { expiresIn: -10 }],
    ])('with %s', async (_case, options) => {
      const response = await meWith(sign(options));

      expect(response.status).toBe(401);
      expect(response.body).toEqual(unauthorized);
    });

    it('with a tampered payload', async () => {
      const [header, , signature] = sign({}).split('.');
      const payload = Buffer.from(
        JSON.stringify({
          sub: '000000000000000000000000',
          sid: sessionId,
          iss: ACCESS_TOKEN_ISSUER,
          aud: ACCESS_TOKEN_AUDIENCE,
          exp: 9999999999,
        }),
      ).toString('base64url');

      await meWith(`${header}.${payload}.${signature}`).expect(401);
    });

    it('with an unsigned token (alg none)', async () => {
      const encode = (value: object) =>
        Buffer.from(JSON.stringify(value)).toString('base64url');
      const token = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub: userId, sid: sessionId, iss: ACCESS_TOKEN_ISSUER, aud: ACCESS_TOKEN_AUDIENCE, exp: 9999999999 })}.`;

      await meWith(token).expect(401);
    });
  });
});

describe('POST /api/auth/refresh', () => {
  it('rotates both cookies, rejects the old refresh token and then revokes the session', async () => {
    const original = tokensOf(await signUp());

    const rotated = await refreshWith(original.refresh, 'expired-or-garbage');
    expect(rotated.status).toBe(200);
    expect(rotated.body).toEqual({
      id: expect.any(String),
      email: expect.any(String),
      name: 'Ada Lovelace',
    });
    const next = tokensOf(rotated);
    expect(next.refresh).not.toBe(original.refresh);
    expect(next.access).not.toBe('');
    expect(next.refresh.split('.')[0]).toBe(original.refresh.split('.')[0]);

    const replay = await refreshWith(original.refresh);
    expect(replay.status).toBe(401);
    expect(replay.body).toEqual(unauthorized);
    expectClearedCookies(replay);

    await refreshWith(next.refresh).expect(401);
    expect(
      await t.sessions.countDocuments({ _id: original.refresh.split('.')[0] }),
    ).toBe(0);
  });

  it('keeps the session expiry fixed at sign-in across rotations', async () => {
    const original = tokensOf(await signUp());
    const sessionId = original.refresh.split('.')[0];
    const before = (await t.sessions.findById(sessionId).lean())?.expiresAt;

    const rotated = await refreshWith(original.refresh).expect(200);

    const after = (await t.sessions.findById(sessionId).lean())?.expiresAt;
    expect(before).toBeInstanceOf(Date);
    expect(after?.getTime()).toBe(before?.getTime());
    const expectedMaxAge = (before!.getTime() - Date.now()) / 1000;
    expect(maxAgeOf(setCookie(rotated, CookieName.Refresh))).toBeCloseTo(
      expectedMaxAge,
      -1,
    );
  });

  it('lets only one of two concurrent refreshes with the same token win, then revokes the session', async () => {
    const original = tokensOf(await signUp());

    const responses = await Promise.all([
      refreshWith(original.refresh),
      refreshWith(original.refresh),
    ]);

    expect(responses.map((r) => r.status).sort((a, b) => a - b)).toEqual([
      200, 401,
    ]);
    const winner = responses.find((r) => r.status === 200);
    await refreshWith(tokensOf(winner!).refresh).expect(401);
  });

  it('fails after the session reached its fixed expiry', async () => {
    const original = tokensOf(await signUp());
    await t.sessions.updateOne(
      { _id: original.refresh.split('.')[0] },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );

    const response = await refreshWith(original.refresh);

    expect(response.status).toBe(401);
    expectClearedCookies(response);
    expect(await sessionCount(original.refresh)).toBe(1);
  });

  it('declares a TTL index so Mongo deletes expired sessions', async () => {
    const indexes = await t.sessions.listIndexes();

    expect(indexes).toContainEqual(
      expect.objectContaining({ key: { expiresAt: 1 }, expireAfterSeconds: 0 }),
    );
  });

  it.each([
    ['no refresh cookie', ''],
    ['a malformed refresh cookie', `${CookieName.Refresh}=garbage`],
    [
      'a JSON cookie carrying an operator',
      `${CookieName.Refresh}=j:${encodeURIComponent('{"$ne":null}')}`,
    ],
    [
      'an unknown session id',
      `${CookieName.Refresh}=000000000000000000000000.${'a'.repeat(43)}.${'a'.repeat(43)}`,
    ],
  ])('answers 401 and clears both cookies for %s', async (_case, cookie) => {
    const response = await t.http().post(path.refresh).set('Cookie', cookie);

    expect(response.status).toBe(401);
    expect(response.body).toEqual(unauthorized);
    expectClearedCookies(response);
  });
});

describe('refresh token family', () => {
  const madeUp = 'a'.repeat(43);

  it('lets a token that was already rotated out end the session on logout', async () => {
    const original = tokensOf(await signUp());
    const next = tokensOf(await refreshWith(original.refresh).expect(200));

    await logoutWith(original.refresh).expect(204);

    await refreshWith(next.refresh).expect(401);
  });

  it('revokes the session when a token from two rotations ago is replayed', async () => {
    const original = tokensOf(await signUp());
    const second = tokensOf(await refreshWith(original.refresh).expect(200));
    const third = tokensOf(await refreshWith(second.refresh).expect(200));

    await refreshWith(original.refresh).expect(401);

    expect(await sessionCount(original.refresh)).toBe(0);
    await refreshWith(third.refresh).expect(401);
  });

  it('leaves the session intact through logout and refresh with a forged family and secret', async () => {
    const tokens = tokensOf(await signUp());
    const forged = `${tokens.refresh.split('.')[0]}.${madeUp}.${madeUp}`;

    await logoutWith(forged).expect(204);
    await refreshWith(forged).expect(401);

    expect(await sessionCount(tokens.refresh)).toBe(1);
    await refreshWith(tokens.refresh).expect(200);
  });

  it('revokes the session for the real family with a made-up secret, because only a past holder of a real token knows the family', async () => {
    const tokens = tokensOf(await signUp());
    const [sessionId, family] = tokens.refresh.split('.');

    await refreshWith(`${sessionId}.${family}.${madeUp}`).expect(401);

    expect(await sessionCount(tokens.refresh)).toBe(0);
    await refreshWith(tokens.refresh).expect(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('revokes the session, clears both cookies and is idempotent', async () => {
    const tokens = tokensOf(await signUp());
    const cookie = `${CookieName.Refresh}=${tokens.refresh}; ${CookieName.Access}=garbage`;

    const first = await t.http().post(path.logout).set('Cookie', cookie);
    expect(first.status).toBe(204);
    expectClearedCookies(first);
    expect(
      await t.sessions.countDocuments({ _id: tokens.refresh.split('.')[0] }),
    ).toBe(0);

    await t.http().post(path.logout).set('Cookie', cookie).expect(204);
    await refreshWith(tokens.refresh).expect(401);
  });

  it.each([
    ['no cookies', ''],
    ['a malformed refresh cookie', `${CookieName.Refresh}=garbage`],
    [
      'a JSON cookie carrying an operator',
      `${CookieName.Refresh}=j:${encodeURIComponent('{"$ne":null}')}`,
    ],
  ])('answers 204 with %s', async (_case, cookie) => {
    await t.http().post(path.logout).set('Cookie', cookie).expect(204);
  });
});

describe('cross-cutting behaviour', () => {
  it('rejects a state-changing request from another origin with 403', async () => {
    const response = await t
      .http()
      .post(path.signIn)
      .set('Origin', 'https://evil.example')
      .send({ email: 'a@example.com', password: PASSWORD });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      statusCode: 403,
      error: HttpErrorName.Forbidden,
      message: expect.any(String),
    });
  });

  it('accepts a state-changing request from the app origin', async () => {
    await t
      .http()
      .post(path.signIn)
      .set('Origin', APP_ORIGIN)
      .send({ email: 'a@example.com', password: PASSWORD })
      .expect(401);
  });

  it('answers malformed JSON with the error contract', async () => {
    const response = await t
      .http()
      .post(path.signIn)
      .set('Content-Type', 'application/json')
      .send('{"email":');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      statusCode: 400,
      error: HttpErrorName.BadRequest,
      message: expect.any(String),
    });
  });

  it('answers an unexpected error with a generic 500 and logs the error', async () => {
    const marker = 'internal-detail-that-must-not-leak';
    const failure = new Error(marker);
    vi.spyOn(t.app.get(UsersService), 'findById').mockRejectedValueOnce(
      failure,
    );
    const logError = vi.spyOn(Logger.prototype, 'error');
    const { access } = tokensOf(await signUp());

    const response = await meWith(access);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      statusCode: 500,
      error: HttpErrorName.InternalServerError,
      message: ErrorMessage.InternalServerError,
    });
    expect(response.text).not.toContain(marker);
    expect(logError).toHaveBeenCalledWith(failure);
    logError.mockRestore();
  });

  it('answers an oversized body with 413 in the error contract', async () => {
    const response = await t
      .http()
      .post(path.signIn)
      .send({ email: 'a@example.com', password: 'x'.repeat(200_000) });

    expect(response.status).toBe(413);
    expect(response.body).toEqual({
      statusCode: 413,
      error: HttpErrorName.PayloadTooLarge,
      message: expect.any(String),
    });
  });

  it('rejects a JSON array body with 400', async () => {
    await t.http().post(path.signIn).send([]).expect(400);
  });

  it('answers an unknown route with the error contract', async () => {
    const response = await t.http().get('/api/nope');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      statusCode: 404,
      error: HttpErrorName.NotFound,
      message: expect.any(String),
    });
  });

  it('serves the API docs outside production', async () => {
    await t.http().get(path.docs).expect(200);
  });
});

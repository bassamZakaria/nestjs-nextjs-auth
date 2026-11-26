# Auth module

Sign up, sign in and a protected page, built with NestJS, MongoDB and Next.js in TypeScript.

| Part | Stack |
|---|---|
| `backend/` | NestJS, Mongoose, argon2id, JWT, Swagger, pino, Vitest |
| `frontend/` | Next.js (App Router), React Hook Form, zod, Tailwind, Vitest |
| Database | MongoDB (Docker Compose for local development) |
| CI | GitHub Actions: lint, typecheck, test and build for both packages |

See [AI.md](AI.md) for how AI assistance was used.

## Run it locally

Requirements: Node 22.22.3+, 24.15+ or 26+, npm 10 and Docker.

```bash
# 1. MongoDB
docker compose up -d

# 2. API on http://localhost:4000
cd backend
cp .env.example .env
# set JWT_ACCESS_SECRET in .env, for example with: openssl rand -base64 48
npm ci
npm run start:dev

# 3. Web app on http://localhost:3000 (in a second terminal)
cd frontend
npm ci
npm run dev
```

Open <http://localhost:3000>. Use `localhost`, not `127.0.0.1`: the API rejects state-changing requests whose `Origin` is not `APP_ORIGIN`.

API documentation (Swagger) is at <http://localhost:3000/api/docs> outside production.

## Tests and checks

```bash
(cd backend  && npm run lint && npm run typecheck && npm run build && npm test)
(cd frontend && npm run lint && npm run typecheck && npm test && npm run build)
```

Back-end tests are end-to-end: they boot the real application against an in-memory MongoDB, so they need no Docker. They cover validation, duplicate emails, the generic sign-in error, refresh rotation and replay, concurrent refreshes, session expiry, logout, the Origin check, JWT tampering, operator-object injection, rate limiting and production cookie settings. Front-end tests cover the form rules and the API client's refresh-and-retry logic.

## How it works

The browser only talks to the Next.js origin. Next.js rewrites `/api/*` to the NestJS server, so everything is same-origin and no CORS configuration exists.

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /api/auth/signup` | public | Create the account and sign in |
| `POST /api/auth/signin` | public | Sign in |
| `POST /api/auth/refresh` | refresh cookie | Rotate the session's tokens |
| `POST /api/auth/logout` | refresh cookie | Revoke the session |
| `GET /api/users/me` | access cookie | Protected: the signed-in user |

Field rules are enforced on both sides: a valid email; a name of at least 3 characters; a password of at least 8 characters with a letter, a number and a special character (anything that is not a letter, digit or whitespace). The name and password rules use the same regular expressions on both sides; email is validated by zod on the client and class-validator on the server, which agree on ordinary addresses.

### Session design

- **Access token:** a JWT (HS256, 15 minutes by default, set by `ACCESS_TOKEN_TTL_SECONDS`) carrying the user id. Verification pins the algorithm and checks issuer, audience and expiry.
- **Refresh token:** an opaque `<sessionId>.<family>.<secret>` value. The family is fixed for the life of the session; the secret changes on every refresh. MongoDB stores only SHA-256 hashes of both.
- **Cookies:** both tokens live in `HttpOnly`, `SameSite=Strict` cookies, so page scripts can never read them. In production they are also `Secure` and use the `__Host-` name prefix.
- **Rotation:** every refresh swaps the stored secret hash in one atomic update and issues a new refresh token. Presenting an older secret from the same family is treated as theft and revokes the session. A guessed session id without the family does nothing.
- **Lifetime:** a session ends 7 days after sign-in. Rotation never extends it. A TTL index removes expired sessions.
- **Logout:** deletes the session on the server and clears both cookies. Any refresh token ever issued for the session can end it.
- **Browser client:** on a `401` it refreshes once and retries. Refreshes are serialised across tabs with the Web Locks API, so two tabs never present the same refresh token.

### Security measures

- Passwords hashed with argon2id at OWASP's recommended minimum; the hash is never selected or serialised.
- Sign-in returns one generic error, and an unknown email still costs a hash verification so timing does not reveal it.
- The auth guard is global and denies by default; public routes opt out explicitly. Identity always comes from the token, never from the request.
- An `Origin` check on every state-changing request, on top of `SameSite=Strict`.
- Strict DTO validation with unknown fields rejected, which also blocks MongoDB operator objects such as `{"email":{"$ne":null}}`.
- Rate limits per IP on every route, stricter on sign-up, sign-in and refresh, plus a per-email limit on sign-in.
- Environment validated at boot. The app refuses to start without `NODE_ENV`, a 32+ character `JWT_ACCESS_SECRET`, `MONGODB_URI` and `APP_ORIGIN`.
- Security headers on the API (helmet, `Cache-Control: no-store`) and on the pages (CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`).
- Structured logs with cookies and authorization headers redacted, request bodies never logged, and auth events recorded.
- One exception filter gives every error the same JSON shape and never leaks internals.

## Configuration

`backend/.env`:

| Variable | Default | Notes |
|---|---|---|
| `NODE_ENV` | required | `development`, `production` or `test` |
| `MONGODB_URI` | required | |
| `JWT_ACCESS_SECRET` | required | At least 32 characters |
| `APP_ORIGIN` | required | The web app's origin, for example `http://localhost:3000` |
| `ACCESS_TOKEN_TTL_SECONDS` | `900` | Access-token lifetime (1–86400). Set to `60` to see the silent refresh a minute after signing in |
| `HOST` | `127.0.0.1` | Set to `0.0.0.0` in a container |
| `PORT` | `4000` | |
| `TRUST_PROXY_HOPS` | `0` | See "Running in production" |
| `LOG_LEVEL` | `info` | |

`frontend`: `API_URL` (default `http://localhost:4000`). It is read by `next build`, so set it before building.

## Running in production

- Put a TLS-terminating reverse proxy in front of Next.js. The `Secure` and `__Host-` cookies require HTTPS.
- That proxy must set `X-Forwarded-For`; then set `TRUST_PROXY_HOPS=1`. Next.js does not add the header itself, so with the default of `0` every client shares one rate-limit bucket, which is safe but coarse.
- Set `NODE_ENV=production`. This enables the production cookie settings and turns the API docs off.
- Keep the API unreachable from the internet; only Next.js should call it.

## Known limitations and trade-offs

- **Access tokens are stateless.** After logout a copied access token still works until it expires, at most 15 minutes. The refresh token is dead immediately.
- **Sign-up reveals that an email is taken** (`409`). Hiding it needs an email verification flow, which is out of scope.
- **Rate-limit counters are in memory.** Running more than one API instance needs a shared store such as Redis.
- **The per-email sign-in limit can be used to lock someone out** for 15 minutes by guessing wrong 10 times. That is the usual trade-off against credential stuffing.
- **A lost refresh response signs the user out.** Replaying the previous refresh token is indistinguishable from theft, so the session is revoked and the user signs in again.
- **The page CSP allows inline scripts.** The pages are static, and a nonce-based policy would force dynamic rendering. React's escaping is the main XSS defence, and the cookies are unreadable by scripts either way.
- **Password composition rules** come from the task. Current OWASP guidance prefers length and breached-password checks over composition rules.
- Not included: email verification, password reset, multi-factor authentication and a "sign out everywhere" action.

## Project layout

```
backend/src/auth      sign-up, sign-in, refresh, logout, sessions, guard, cookies, throttling
backend/src/users     user schema, GET /users/me
backend/src/common    exception filter, Origin guard, routes
backend/src/config    environment validation
backend/test          end-to-end tests
frontend/src/app      pages: /, /signin, /signup
frontend/src/components   forms, fields, password checklist, protected page
frontend/src/lib      API client, zod schemas, routes, messages
```

# Auth module

Sign up, sign in and a protected page — NestJS + MongoDB + Next.js, all TypeScript.

| | Stack |
|---|---|
| **Backend** | NestJS, Mongoose, argon2id, JWT, Swagger, pino, Vitest |
| **Frontend** | Next.js (App Router), React Hook Form, zod, Tailwind, Vitest |
| **Database** | MongoDB (via Docker Compose) |
| **CI** | GitHub Actions — lint, typecheck, test, build |

## Quick start

Needs Node 22.22.3+, npm 10 and Docker.

```bash
docker compose up -d                 # MongoDB

cd backend                           # API → http://localhost:4000
cp .env.example .env                 # then set JWT_ACCESS_SECRET (openssl rand -base64 48)
npm ci && npm run start:dev

cd frontend                          # Web → http://localhost:3000
npm ci && npm run dev
```

Open **http://localhost:3000** (use `localhost`, not `127.0.0.1`).
API docs (Swagger): **http://localhost:3000/api/docs**.

Run all checks:

```bash
(cd backend  && npm run lint && npm run typecheck && npm run build && npm test)
(cd frontend && npm run lint && npm run typecheck && npm test && npm run build)
```

## What's built

- [x] Sign-up form — email, name (3+ chars), strong password, validated live
- [x] Sign-in form
- [x] Protected application page with a logout button
- [x] NestJS API with MongoDB; validation enforced server-side too
- [x] Protected endpoint (`GET /api/users/me`)
- [x] Short-lived access token + rotating refresh token, in `HttpOnly` cookies
- [x] Refresh-token theft detection
- [x] Rate limiting, security headers, structured logging, global error handling
- [x] Swagger API docs
- [x] Tests (72 backend e2e, 45 frontend) and CI

## Endpoints

The browser only talks to Next.js, which proxies `/api/*` to the API — so everything is same-origin and there is no CORS.

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /api/auth/signup` | public | Create the account and sign in |
| `POST /api/auth/signin` | public | Sign in |
| `POST /api/auth/refresh` | refresh cookie | Rotate the session's tokens |
| `POST /api/auth/logout` | refresh cookie | Revoke the session |
| `GET /api/users/me` | access cookie | The signed-in user (protected) |

**Field rules** (enforced on both sides): valid email; name ≥ 3 chars; password ≥ 8 chars with a letter, a number and a special character.

## How sessions work

- **Access token** — a 15-minute JWT (configurable) in an `HttpOnly` cookie. The browser auto-refreshes it on a `401`.
- **Refresh token** — `sessionId.family.secret`; MongoDB stores only hashes. Each refresh rotates the secret; replaying an old one is treated as theft and kills the session.
- **Cookies** — `HttpOnly` + `SameSite=Strict` always; `Secure` + `__Host-` prefix in production. Page scripts can never read the tokens.
- **Logout / expiry** — logout deletes the session server-side; sessions also end 7 days after sign-in.

**Security highlights:** argon2id password hashing · generic sign-in error with constant-time behaviour · deny-by-default auth guard · `Origin` check on writes · input validation that blocks NoSQL operator injection · secrets validated at boot · helmet + CSP headers · redacted logs.

## Configuration

`backend/.env` (see `.env.example`):

| Variable | Default | Notes |
|---|---|---|
| `NODE_ENV` | required | `development` / `production` / `test` |
| `MONGODB_URI` | required | |
| `JWT_ACCESS_SECRET` | required | 32+ characters |
| `APP_ORIGIN` | required | e.g. `http://localhost:3000` |
| `ACCESS_TOKEN_TTL_SECONDS` | `900` | Set to `60` to watch the silent refresh during a demo |
| `HOST` / `PORT` | `127.0.0.1` / `4000` | |
| `TRUST_PROXY_HOPS` | `0` | Set `1` only behind a proxy that sets `X-Forwarded-For` |
| `LOG_LEVEL` | `info` | |

`frontend`: `API_URL` (default `http://localhost:4000`), read at build time.

**In production:** terminate TLS at a reverse proxy in front of Next.js, set `NODE_ENV=production`, and keep the API reachable only from Next.js.

## Roadmap

**Next up — Passwordless login.** Email magic link / one-time code as an alternative to passwords, reusing the same session and cookie machinery.

Then, in rough order:

- [ ] Email verification on sign-up (also closes the "email is taken" disclosure)
- [ ] Password reset
- [ ] Multi-factor authentication (TOTP / passkeys)
- [ ] "Sign out everywhere" and an active-sessions list
- [ ] Redis-backed rate limiting and sessions for multi-instance deploys

## Known limitations

- A copied access token stays valid until it expires (≤ 15 min) after logout — the usual stateless-JWT trade-off.
- Sign-up reveals whether an email is taken (`409`); closed by email verification above.
- Rate-limit counters are in memory — one instance only until Redis is added.
- Password composition rules come from the task; modern guidance prefers length + breached-password checks.

## Layout

```
backend/src/auth     sign-up, sign-in, refresh, logout, sessions, guard, cookies, throttling
backend/src/users    user schema, GET /users/me
backend/src/common   exception filter, Origin guard, routes
backend/src/config   environment validation
frontend/src/app     pages: /, /signin, /signup
frontend/src/components   forms, fields, password checklist, protected page
frontend/src/lib     API client, zod schemas, routes, messages
```

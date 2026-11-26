# Auth module

Sign up, sign in and a protected page. NestJS + MongoDB + Next.js, all TypeScript.

How AI was used to build it: [AI.md](AI.md).

## Run it

Docker is used only so that one command starts everything: MongoDB, the API and the web app. Nothing else needs installing.

```bash
docker compose up --build
```

Then open **http://localhost:3000** (use `localhost`, not `127.0.0.1`). API docs: http://localhost:3000/api/docs.

The access token lasts 15 minutes. To watch it refresh silently after one minute instead:

```bash
ACCESS_TOKEN_TTL_SECONDS=60 docker compose up --build
```

In PowerShell: `$env:ACCESS_TOKEN_TTL_SECONDS=60; docker compose up --build`.

## What's built

- [x] Sign-up form: email, name (3+ chars), strong password, validated live
- [x] Sign-in form
- [x] Protected page ("Welcome to the application.") with a logout button
- [x] NestJS API with MongoDB; the same validation enforced server-side
- [x] Protected endpoint: `GET /api/users/me`
- [x] Short-lived access token + rotating refresh token in `HttpOnly` cookies, with theft detection
- [x] Rate limiting, security headers, structured logging, global error handling
- [x] Swagger docs, 72 backend and 45 frontend tests, CI on GitHub Actions

## How it works

![Animated diagram: the access token expires and the browser refreshes it silently](docs/silent-refresh.svg)

**[Step through all 15 flows →](https://bassamzakaria.github.io/nestjs-nextjs-auth/)** Sign-up, sign-in, refresh, logout, a stolen token, CSRF, rate limiting and more, each with the code location.

- **Access token:** a 15-minute JWT. The API verifies it without a database call.
- **Refresh token:** `sessionId.family.secret`. MongoDB stores only hashes. Each refresh swaps the secret; replaying an old one is treated as theft and ends the session.
- **Cookies:** both tokens are `HttpOnly` and `SameSite=Strict`, so page scripts never see them. A write that carries an `Origin` header must match the app's own.
- **Sessions:** one per sign-in. Logout deletes it on the server; it also ends 7 days after sign-in.
- **Passwords:** argon2id. Sign-in gives the same error, in the same time, for a wrong password and an unknown email.

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /api/auth/signup` | public | Create the account and sign in |
| `POST /api/auth/signin` | public | Sign in |
| `POST /api/auth/refresh` | refresh cookie | Rotate the session's tokens |
| `POST /api/auth/logout` | refresh cookie | End the session |
| `GET /api/users/me` | access cookie | The signed-in user (protected) |

## Run without Docker

Needs Node 22.22.3+ and any MongoDB: a local install, or a free MongoDB Atlas cluster.

```bash
cd backend                           # API on :4000
cp .env.example .env                 # set JWT_ACCESS_SECRET (openssl rand -base64 48)
npm ci && npm run start:dev

cd frontend                          # web on :3000, in a second terminal
npm ci && npm run dev
```

The API expects MongoDB at `mongodb://127.0.0.1:27017/auth`; for any other address, change `MONGODB_URI` in `backend/.env`. Every setting is described in [`backend/.env.example`](backend/.env.example).

Checks, in either folder: `npm run lint && npm run typecheck && npm test && npm run build`. The tests start their own in-memory MongoDB, so they need neither Docker nor a database.

## Roadmap

**Next: passwordless login.** An email magic link or one-time code, reusing the same sessions and cookies.

- [ ] Email verification on sign-up
- [ ] Password reset
- [ ] Multi-factor authentication (TOTP / passkeys)
- [ ] "Sign out everywhere" and a list of active sessions
- [ ] Redis-backed rate limiting, to run more than one API instance

## Known limitations

- A copied access token keeps working after logout until it expires (at most 15 minutes).
- Sign-up reveals whether an email is taken (`409`). Email verification closes this.
- Rate-limit counters are in memory, so they are per instance and reset on restart. Behind the Next.js proxy the per-IP limits are shared by all users; only the per-email sign-in limit is per user.
- The Docker setup is for local review: it runs over plain HTTP and makes a new JWT secret on every start. Production needs TLS in front of Next.js, `NODE_ENV=production` and a fixed secret.

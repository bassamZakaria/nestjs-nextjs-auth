# How AI was used

Almost all the code in this repository was written by AI agents (Claude Code) that I directed. My part was the decisions, the direction and judging what came back. This file records how that went, including where the AI was wrong.

## How I worked

1. **Plan before code.** I gave the assistant the task and had it propose a plan, then questioned its choices until I agreed with the design. No code was written during this stage.
2. **A written contract.** The plan became a short spec with a fixed HTTP contract (paths, status codes, JSON shapes, field rules). Two agents then built the back end and the front end in parallel against it.
3. **Independent review, in rounds.** Reviewer agents that had not written the code looked at it from separate angles: security, back end, front end and accessibility. They had to reproduce a problem before reporting it. Valid findings were fixed and the result was reviewed again. This ran for three rounds, until a round came back with no real bugs.
4. **A real browser run.** The finished app was driven in a browser against the real API and MongoDB: sign-up, silent refresh, two tabs, a second device, a replayed refresh token, logout, the back button, rate limiting, mobile widths and dark mode.

## My Claude setup and harness

I don't use AI as a one-shot code generator. I run Claude Code with a standing configuration that forces a discipline on every task, so the output is reviewed and verified before I trust it.

- **Standing rules (a global `CLAUDE.md`).** Every session starts under rules I set once and reuse across projects: plan and get my sign-off before writing non-trivial code; load the relevant skills before coding, testing or reviewing; run an independent review loop after every implementation; work on a branch, never the main branch; and a model policy (a strong model for architecture and review, a cheaper one for mechanical work).
- **Skills.** I keep a library of task-specific skill files that inject the right checklist at the right moment. On this task that included a "lazy senior" skill that keeps the diff minimal, backend skills for NestJS and for auth and session design, a security-discipline skill, a secure-code skill, front-end and React best-practice skills, an accessibility-audit skill, and a testing skill that forces a "what is worth testing" decision instead of chasing coverage. The skills are why the first draft already had argon2id, deny-by-default guards and an Origin check rather than my having to remember each one.
- **The review loop.** After each change, reviewer agents that did **not** write the code run in parallel on a stronger model, each with one focus: correctness, security, front end, accessibility. Each must reproduce a problem before reporting it; I verify each finding and reject false positives with a reason; valid ones are fixed and the updated diff goes through a fresh round. The loop is capped at three rounds, and it stops when a round returns no real bugs. Here it caught two high-severity security bugs in round 1 and a regression my own round-1 fix introduced in round 2 — things a single pass would have shipped.
- **Verification, not vibes.** Claims are checked, not assumed: the full flow was driven in a real browser (Playwright) against the real API and MongoDB, and for anything security-sensitive I had the assistant read the official sources (the OWASP cheat sheets, the framework docs) rather than answer from memory.

## Decisions I made differently from what the AI suggested

- **Framework.** It proposed React with Vite. I chose Next.js, which the task allows and which I already use.
- **Session lifetime.** To save time it proposed a single one-hour token. I chose a short access token with a rotating refresh token.
- **Cookies or Bearer tokens.** The projects I work on send Bearer tokens issued by a managed identity provider, so I asked why this should differ and had the assistant compare the two. In those projects an external provider issues the tokens and the client SDK keeps them where scripts can read them. Here I own the server that issues them, so `HttpOnly` cookies are possible and safer. I kept cookies.
- **Scope.** I asked for the code to stay small. Several review suggestions were turned down as not worth the code: a nonce-based CSP, rolling back a sign-up if the session insert fails, and extra tests for things already documented.
- **Testing the token expiry.** I made the access-token lifetime an environment variable (`ACCESS_TOKEN_TTL_SECONDS`, 15 minutes by default) so the short-lived token and its silent refresh can be watched within a minute instead of waiting fifteen.
- **Monorepo tooling.** I asked whether this should be a workspace monorepo (npm workspaces or Turborepo) with a shared package for the validation rules and types. We weighed it and I kept two plain folders: the two apps share about ten lines of constants, and a workspace would add a root config, a third package to build and more complex Docker and CI for that. I would add it once there is real shared code, such as an API client.

## Where the AI was wrong

**In the design, before any code** (found by a security pass I asked for):

- It said attackers could not tell which emails exist. That is false for sign-up, which returns `409`. It is now a documented limitation.
- Its first session design had gaps: a replayed refresh token would not have been detected, rotation was not atomic, a session could be renewed forever, two browser tabs would have signed each other out, and there was no `Origin` check.

**In the code** (found by the reviewer agents, each reproduced):

- **Review round 1.** Anyone who guessed a session id could log that user out. Rate limiting trusted a header the client controls, because the plan wrongly assumed Next.js forwards the client address; it does not. The example env file shipped a placeholder secret long enough to pass validation. `NODE_ENV` defaulted to development. A pending submit button lost keyboard focus, input borders had too little contrast, and a long email overflowed on small screens.
- **Review round 2.** The fix for the forced logout over-corrected. Logout no longer ended a session that a thief had already refreshed, and refreshing twice got past theft detection. The design was replaced with a token "family". The accessibility fix for the pending button reopened a double submit.
- **Review round 3.** No new bugs. The reviewers tried to break the token-family design as four kinds of attacker (no account, one account, a stolen refresh token, a database dump) and could not. The remaining findings were documentation wording and a few lines of dead code, which were fixed.

**In the scaffolding:**

- The NestJS scaffold arrived with a telemetry module and agent instruction files, which were removed. The Next.js scaffold enabled experimental caching and a bundler-specific Tailwind loader, which were replaced with the documented setup.
- Generic AI guidance suggested bcrypt and Passport. I kept argon2id, OWASP's first choice, and a plain guard with no extra dependency.

## What worked well

- **Contract first.** With the HTTP contract fixed up front, the two halves worked together on the first integration run.
- **"Prove it with a test."** Agents were told to verify behaviour with tests and to break the code on purpose to confirm a test fails.
- **Reviewers with separate focuses.** They found real bugs the implementing agents missed, and a second round caught regressions the first fixes introduced.
- **Asking for the limits.** The README lists what this does not do and why.

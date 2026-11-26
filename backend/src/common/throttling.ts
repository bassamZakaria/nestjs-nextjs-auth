import type { ExecutionContext } from '@nestjs/common';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import type { Request } from 'express';
import { normaliseEmail } from './normalise-email.js';

export enum ThrottlerName {
  Default = 'default',
  SignInEmail = 'sign-in-email',
}

const MINUTE_MS = 60_000;

export const STRICT_LIMITS = {
  signUp: { [ThrottlerName.Default]: { limit: 5, ttl: MINUTE_MS } },
  signIn: { [ThrottlerName.Default]: { limit: 10, ttl: MINUTE_MS } },
  refresh: { [ThrottlerName.Default]: { limit: 30, ttl: MINUTE_MS } },
};

export const SIGN_IN_PER_EMAIL_LIMIT = { limit: 5, ttl: 15 * MINUTE_MS };

const bodyEmail = (request: Request): unknown =>
  (request.body as { email?: unknown } | undefined)?.email;

export const throttlerOptions: ThrottlerModuleOptions = {
  errorMessage: 'Too many requests, please try again later',
  // shortcut: in-memory storage is per process and resets on restart, use a Redis ThrottlerStorage once the API runs on more than one instance
  throttlers: [
    { name: ThrottlerName.Default, limit: 100, ttl: MINUTE_MS },
    {
      name: ThrottlerName.SignInEmail,
      ...SIGN_IN_PER_EMAIL_LIMIT,
      skipIf: (context: ExecutionContext) =>
        typeof bodyEmail(context.switchToHttp().getRequest<Request>()) !==
        'string',
      getTracker: (request) =>
        `email:${String(normaliseEmail(bodyEmail(request as Request)))}`,
    },
  ],
};

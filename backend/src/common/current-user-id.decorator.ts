import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export type AccessTokenPayload = { sub: string; sid: string };

export type AuthenticatedRequest = Request & { user: AccessTokenPayload };

export const CurrentUserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user.sub,
);

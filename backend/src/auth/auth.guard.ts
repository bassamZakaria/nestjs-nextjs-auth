import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type {
  AccessTokenPayload,
  AuthenticatedRequest,
} from '../common/current-user-id.decorator.js';
import { IS_PUBLIC_KEY } from '../common/public.decorator.js';
import { AppConfigService } from '../config/env.validation.js';
import { cookieNamesFor, readCookie } from './auth-cookies.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const { access } = cookieNamesFor(
      this.config.get('NODE_ENV', { infer: true }),
    );
    request.user = await this.verify(readCookie(request, access));
    return true;
  }

  private async verify(token: string | undefined) {
    if (!token) {
      throw new UnauthorizedException();
    }
    try {
      const { sub } = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      return { sub };
    } catch {
      throw new UnauthorizedException();
    }
  }
}

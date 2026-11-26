import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../common/public.decorator.js';
import type { EnvironmentVariables } from '../config/env.validation.js';
import type {
  AccessTokenPayload,
  AuthenticatedRequest,
} from './access-token.js';
import { cookieNamesFor, readCookie } from './auth-cookies.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
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
      const { sub, sid } =
        await this.jwt.verifyAsync<AccessTokenPayload>(token);
      return { sub, sid };
    } catch {
      throw new UnauthorizedException();
    }
  }
}

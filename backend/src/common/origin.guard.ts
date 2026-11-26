import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { EnvironmentVariables } from '../config/env.validation.js';

enum SafeMethod {
  Get = 'GET',
  Head = 'HEAD',
  Options = 'OPTIONS',
}

const SAFE_METHODS = new Set<string>(Object.values(SafeMethod));

@Injectable()
export class OriginGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const origin = request.headers.origin;
    if (SAFE_METHODS.has(request.method) || origin === undefined) {
      return true;
    }
    if (origin !== this.config.get('APP_ORIGIN', { infer: true })) {
      throw new ForbiddenException('Cross-origin request rejected');
    }
    return true;
  }
}

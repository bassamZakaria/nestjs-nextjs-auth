import type { JwtModuleOptions } from '@nestjs/jwt';
import { ACCESS_TOKEN_TTL_SECONDS } from './auth-cookies.js';

export const ACCESS_TOKEN_ISSUER = 'auth-api';
export const ACCESS_TOKEN_AUDIENCE = 'auth-web';

const ALGORITHM = 'HS256';

export const jwtOptions = (secret: string): JwtModuleOptions => ({
  secret,
  signOptions: {
    algorithm: ALGORITHM,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    issuer: ACCESS_TOKEN_ISSUER,
    audience: ACCESS_TOKEN_AUDIENCE,
  },
  verifyOptions: {
    algorithms: [ALGORITHM],
    issuer: ACCESS_TOKEN_ISSUER,
    audience: ACCESS_TOKEN_AUDIENCE,
  },
});

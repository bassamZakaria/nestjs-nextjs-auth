import type { JwtModuleOptions } from '@nestjs/jwt';

export const ACCESS_TOKEN_ISSUER = 'auth-api';
export const ACCESS_TOKEN_AUDIENCE = 'auth-web';

const ALGORITHM = 'HS256';

export const jwtOptions = (
  secret: string,
  ttlSeconds: number,
): JwtModuleOptions => ({
  secret,
  signOptions: {
    algorithm: ALGORITHM,
    expiresIn: ttlSeconds,
    issuer: ACCESS_TOKEN_ISSUER,
    audience: ACCESS_TOKEN_AUDIENCE,
  },
  verifyOptions: {
    algorithms: [ALGORITHM],
    issuer: ACCESS_TOKEN_ISSUER,
    audience: ACCESS_TOKEN_AUDIENCE,
  },
});

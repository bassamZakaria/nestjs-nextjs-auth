import type { CookieOptions, Request, Response } from 'express';
import { NodeEnv } from '../config/env.validation.js';

export enum CookieName {
  Access = 'access_token',
  Refresh = 'refresh_token',
  HostAccess = '__Host-access_token',
  HostRefresh = '__Host-refresh_token',
}

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

type CookieNames = { access: CookieName; refresh: CookieName };

export const cookieNamesFor = (nodeEnv: NodeEnv): CookieNames =>
  nodeEnv === NodeEnv.Production
    ? { access: CookieName.HostAccess, refresh: CookieName.HostRefresh }
    : { access: CookieName.Access, refresh: CookieName.Refresh };

export const baseCookieOptions = (nodeEnv: NodeEnv): CookieOptions => ({
  httpOnly: true,
  sameSite: 'strict',
  path: '/',
  secure: nodeEnv === NodeEnv.Production,
});

export const readCookie = (request: Request, name: CookieName) => {
  const value: unknown = request.cookies?.[name];
  return typeof value === 'string' ? value : undefined;
};

export type IssuedTokens = {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
};

export const setAuthCookies = (
  response: Response,
  nodeEnv: NodeEnv,
  tokens: IssuedTokens,
) => {
  const names = cookieNamesFor(nodeEnv);
  const options = baseCookieOptions(nodeEnv);
  response.cookie(names.access, tokens.accessToken, {
    ...options,
    maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
  });
  response.cookie(names.refresh, tokens.refreshToken, {
    ...options,
    maxAge: tokens.refreshExpiresAt.getTime() - Date.now(),
  });
};

export const clearAuthCookies = (response: Response, nodeEnv: NodeEnv) => {
  const names = cookieNamesFor(nodeEnv);
  const options = baseCookieOptions(nodeEnv);
  response.clearCookie(names.access, options);
  response.clearCookie(names.refresh, options);
};

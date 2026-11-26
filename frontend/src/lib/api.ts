import type { SignInValues, SignUpValues } from "./schemas";

export enum ApiPath {
  SignUp = "/api/auth/signup",
  SignIn = "/api/auth/signin",
  Refresh = "/api/auth/refresh",
  Logout = "/api/auth/logout",
  Me = "/api/users/me",
}

export enum HttpStatus {
  Ok = 200,
  NoContent = 204,
  BadRequest = 400,
  Unauthorized = 401,
  Conflict = 409,
  TooManyRequests = 429,
  BadGateway = 502,
}

enum HttpMethod {
  Get = "GET",
  Post = "POST",
}

const REFRESH_LOCK_NAME = "auth-refresh";

const PATHS_WITHOUT_REFRESH = new Set<string>([
  ApiPath.SignUp,
  ApiPath.SignIn,
  ApiPath.Refresh,
  ApiPath.Logout,
]);

export type User = { id: string; email: string; name: string };

type ErrorBody = { message?: string | string[] };

export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

const toApiError = async (response: Response) => {
  const body: ErrorBody | null = await response.json().catch(() => null);
  const message = Array.isArray(body?.message)
    ? body.message.join(". ")
    : (body?.message ?? response.statusText);
  return new ApiError(response.status, message);
};

const send = (path: ApiPath, method: HttpMethod, body?: object) =>
  fetch(path, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

const parse = async <T>(response: Response) => {
  if (!response.ok) throw await toApiError(response);
  if (response.status === HttpStatus.NoContent) return undefined as T;
  return (await response.json()) as T;
};

const runExclusive = <T>(task: () => Promise<T>) =>
  typeof navigator !== "undefined" && navigator.locks
    ? navigator.locks.request(REFRESH_LOCK_NAME, task)
    : task();

let refreshInFlight: Promise<void> | null = null;

const refreshSession = () => {
  refreshInFlight ??= runExclusive(() =>
    request<User>(ApiPath.Refresh, HttpMethod.Post),
  )
    .then(() => undefined)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
};

const request = async <T>(path: ApiPath, method: HttpMethod, body?: object) => {
  const response = await send(path, method, body);
  if (response.status !== HttpStatus.Unauthorized || PATHS_WITHOUT_REFRESH.has(path)) {
    return parse<T>(response);
  }
  await refreshSession();
  return parse<T>(await send(path, method, body));
};

export const signUp = (body: SignUpValues) =>
  request<User>(ApiPath.SignUp, HttpMethod.Post, body);

export const signIn = (body: SignInValues) =>
  request<User>(ApiPath.SignIn, HttpMethod.Post, body);

export const logout = () => request<void>(ApiPath.Logout, HttpMethod.Post);

export const getMe = () => request<User>(ApiPath.Me, HttpMethod.Get);

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, ApiPath, HttpStatus, getMe, logout, signIn, signUp } from "./api";

enum LockEvent {
  Acquired = "lock acquired",
  RefreshSent = "refresh sent",
  Released = "lock released",
}

const user = { id: "1", email: "ada@example.com", name: "Ada" };

const json = (status: HttpStatus, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

type Responder = () => Response | Promise<Response>;

const stubFetch = (script: Partial<Record<ApiPath, Responder[]>>) => {
  const queues = new Map(Object.entries(script).map(([path, items]) => [path, [...items]]));
  const calls: string[] = [];
  const fetchMock = vi.fn<typeof fetch>(async (input) => {
    const path = String(input);
    calls.push(path);
    const next = queues.get(path)?.shift();
    if (!next) throw new Error(`unexpected request to ${path}`);
    return next();
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls, fetchMock };
};

const countOf = (calls: string[], path: ApiPath) => calls.filter((call) => call === path).length;

beforeEach(() => {
  vi.stubGlobal("navigator", {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("request basics", () => {
  it("returns the parsed body on success and sends same-origin credentials", async () => {
    const { fetchMock } = stubFetch({ [ApiPath.Me]: [() => json(HttpStatus.Ok, user)] });
    await expect(getMe()).resolves.toEqual(user);
    expect(fetchMock).toHaveBeenCalledWith(ApiPath.Me, expect.objectContaining({ credentials: "same-origin" }));
  });

  it("sends JSON bodies", async () => {
    const { fetchMock } = stubFetch({ [ApiPath.SignIn]: [() => json(HttpStatus.Ok, user)] });
    await signIn({ email: "ada@example.com", password: "pw" });
    const init = fetchMock.mock.calls[0][1];
    expect(init?.body).toBe(JSON.stringify({ email: "ada@example.com", password: "pw" }));
    expect(init?.headers).toEqual({ "Content-Type": "application/json" });
  });

  it("resolves a 204 without a body", async () => {
    stubFetch({ [ApiPath.Logout]: [() => new Response(null, { status: HttpStatus.NoContent })] });
    await expect(logout()).resolves.toBeUndefined();
  });

  it("joins array messages and keeps the status code", async () => {
    stubFetch({
      [ApiPath.SignUp]: [() => json(HttpStatus.BadRequest, { statusCode: HttpStatus.BadRequest, error: "Bad Request", message: ["a is bad", "b is bad"] })],
    });
    const error = await signUp({ email: "x", name: "y", password: "z" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ statusCode: HttpStatus.BadRequest, message: "a is bad. b is bad" });
  });

  it("keeps string messages and survives a non-JSON error body", async () => {
    stubFetch({
      [ApiPath.SignUp]: [
        () => json(HttpStatus.Conflict, { statusCode: HttpStatus.Conflict, error: "Conflict", message: "Email taken" }),
        () => new Response("<html>bad gateway</html>", { status: HttpStatus.BadGateway, statusText: "Bad Gateway" }),
      ],
    });
    const body = { email: "x", name: "y", password: "z" };
    await expect(signUp(body)).rejects.toMatchObject({ statusCode: HttpStatus.Conflict, message: "Email taken" });
    await expect(signUp(body)).rejects.toMatchObject({ statusCode: HttpStatus.BadGateway, message: "Bad Gateway" });
  });
});

describe("refresh and retry", () => {
  it("refreshes on 401 and retries the original request once", async () => {
    const { calls } = stubFetch({
      [ApiPath.Me]: [() => json(HttpStatus.Unauthorized, {}), () => json(HttpStatus.Ok, user)],
      [ApiPath.Refresh]: [() => json(HttpStatus.Ok, user)],
    });
    await expect(getMe()).resolves.toEqual(user);
    expect(calls).toEqual([ApiPath.Me, ApiPath.Refresh, ApiPath.Me]);
  });

  it("propagates the error and does not retry when the refresh fails", async () => {
    const { calls } = stubFetch({
      [ApiPath.Me]: [() => json(HttpStatus.Unauthorized, {})],
      [ApiPath.Refresh]: [() => json(HttpStatus.Unauthorized, { statusCode: HttpStatus.Unauthorized, message: "Unauthorized" })],
    });
    await expect(getMe()).rejects.toMatchObject({ statusCode: HttpStatus.Unauthorized });
    expect(calls).toEqual([ApiPath.Me, ApiPath.Refresh]);
  });

  it("retries only once when the retry also returns 401", async () => {
    const { calls } = stubFetch({
      [ApiPath.Me]: [() => json(HttpStatus.Unauthorized, {}), () => json(HttpStatus.Unauthorized, {})],
      [ApiPath.Refresh]: [() => json(HttpStatus.Ok, user)],
    });
    await expect(getMe()).rejects.toMatchObject({ statusCode: HttpStatus.Unauthorized });
    expect(calls).toEqual([ApiPath.Me, ApiPath.Refresh, ApiPath.Me]);
  });

  it("shares one refresh between concurrent 401s", async () => {
    const { calls } = stubFetch({
      [ApiPath.Me]: [() => json(HttpStatus.Unauthorized, {}), () => json(HttpStatus.Unauthorized, {}), () => json(HttpStatus.Ok, user), () => json(HttpStatus.Ok, user)],
      [ApiPath.Refresh]: [() => json(HttpStatus.Ok, user)],
    });
    await expect(Promise.all([getMe(), getMe()])).resolves.toEqual([user, user]);
    expect(countOf(calls, ApiPath.Refresh)).toBe(1);
    expect(countOf(calls, ApiPath.Me)).toBe(4);
  });

  it("starts a new refresh for a later 401 once the first has settled", async () => {
    const { calls } = stubFetch({
      [ApiPath.Me]: [() => json(HttpStatus.Unauthorized, {}), () => json(HttpStatus.Ok, user), () => json(HttpStatus.Unauthorized, {}), () => json(HttpStatus.Ok, user)],
      [ApiPath.Refresh]: [() => json(HttpStatus.Ok, user), () => json(HttpStatus.Ok, user)],
    });
    await getMe();
    await getMe();
    expect(countOf(calls, ApiPath.Refresh)).toBe(2);
  });

  it("starts a fresh refresh for a later 401 after a refresh failed", async () => {
    const { calls } = stubFetch({
      [ApiPath.Me]: [() => json(HttpStatus.Unauthorized, {}), () => json(HttpStatus.Unauthorized, {}), () => json(HttpStatus.Ok, user)],
      [ApiPath.Refresh]: [() => json(HttpStatus.Unauthorized, {}), () => json(HttpStatus.Ok, user)],
    });
    await expect(getMe()).rejects.toMatchObject({ statusCode: HttpStatus.Unauthorized });
    await expect(getMe()).resolves.toEqual(user);
    expect(countOf(calls, ApiPath.Refresh)).toBe(2);
  });

  it.each([
    ["sign-in", () => signIn({ email: "a@b.co", password: "pw" }), ApiPath.SignIn],
    ["sign-up", () => signUp({ email: "a@b.co", name: "Ada", password: "pw" }), ApiPath.SignUp],
    ["logout", () => logout(), ApiPath.Logout],
  ])("never refreshes after a 401 from %s", async (_label, call, path) => {
    const { calls } = stubFetch({ [path]: [() => json(HttpStatus.Unauthorized, { message: "nope" })] });
    await expect(call()).rejects.toMatchObject({ statusCode: HttpStatus.Unauthorized });
    expect(calls).toEqual([path]);
  });

  it("never refreshes after a 401 from refresh itself", async () => {
    const { calls } = stubFetch({
      [ApiPath.Me]: [() => json(HttpStatus.Unauthorized, {})],
      [ApiPath.Refresh]: [() => json(HttpStatus.Unauthorized, {})],
    });
    await expect(getMe()).rejects.toBeInstanceOf(ApiError);
    expect(countOf(calls, ApiPath.Refresh)).toBe(1);
  });
});

describe("cross-tab serialisation", () => {
  it("runs the refresh inside a Web Lock", async () => {
    const order: LockEvent[] = [];
    const request = vi.fn(async (_name: string, task: () => Promise<unknown>) => {
      order.push(LockEvent.Acquired);
      const result = await task();
      order.push(LockEvent.Released);
      return result;
    });
    vi.stubGlobal("navigator", { locks: { request } });
    stubFetch({
      [ApiPath.Me]: [() => json(HttpStatus.Unauthorized, {}), () => json(HttpStatus.Ok, user)],
      [ApiPath.Refresh]: [
        () => {
          order.push(LockEvent.RefreshSent);
          return json(HttpStatus.Ok, user);
        },
      ],
    });
    await getMe();
    expect(request).toHaveBeenCalledTimes(1);
    expect(order).toEqual([LockEvent.Acquired, LockEvent.RefreshSent, LockEvent.Released]);
  });

  it("waits for a lock held elsewhere before sending the refresh", async () => {
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const request = vi.fn(async (_name: string, task: () => Promise<unknown>) => {
      await held;
      return task();
    });
    vi.stubGlobal("navigator", { locks: { request } });
    const { calls } = stubFetch({
      [ApiPath.Me]: [() => json(HttpStatus.Unauthorized, {}), () => json(HttpStatus.Ok, user)],
      [ApiPath.Refresh]: [() => json(HttpStatus.Ok, user)],
    });
    const pending = getMe();
    await vi.waitFor(() => expect(request).toHaveBeenCalled());
    expect(calls).toEqual([ApiPath.Me]);
    release();
    await expect(pending).resolves.toEqual(user);
    expect(calls).toEqual([ApiPath.Me, ApiPath.Refresh, ApiPath.Me]);
  });

  it("runs logout inside the same Web Lock", async () => {
    const request = vi.fn((name: string, task: () => Promise<unknown>) => task());
    vi.stubGlobal("navigator", { locks: { request } });
    stubFetch({ [ApiPath.Logout]: [() => new Response(null, { status: HttpStatus.NoContent })] });
    await logout();
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toBe("auth-refresh");
  });

  it("falls back to the in-tab refresh when navigator is undefined", async () => {
    vi.stubGlobal("navigator", undefined);
    const { calls } = stubFetch({
      [ApiPath.Me]: [() => json(HttpStatus.Unauthorized, {}), () => json(HttpStatus.Ok, user)],
      [ApiPath.Refresh]: [() => json(HttpStatus.Ok, user)],
    });
    await expect(getMe()).resolves.toEqual(user);
    expect(calls).toEqual([ApiPath.Me, ApiPath.Refresh, ApiPath.Me]);
  });
});

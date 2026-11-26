import { Controller, Get } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Model } from 'mongoose';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { Session } from '../src/auth/session.schema.js';
import { AuthRoute, RoutePrefix, UsersRoute } from '../src/common/routes.js';
import { NodeEnv } from '../src/config/env.validation.js';
import { User } from '../src/users/user.schema.js';

export const APP_ORIGIN = 'http://localhost:3000';
export const JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';

export enum ProbeRoute {
  Undecorated = 'probe',
}

@Controller(ProbeRoute.Undecorated)
class UndecoratedProbeController {
  @Get()
  probe() {
    return { reached: true };
  }
}

export const path = {
  signUp: `/${RoutePrefix.Api}/${RoutePrefix.Auth}/${AuthRoute.SignUp}`,
  signIn: `/${RoutePrefix.Api}/${RoutePrefix.Auth}/${AuthRoute.SignIn}`,
  refresh: `/${RoutePrefix.Api}/${RoutePrefix.Auth}/${AuthRoute.Refresh}`,
  logout: `/${RoutePrefix.Api}/${RoutePrefix.Auth}/${AuthRoute.Logout}`,
  me: `/${RoutePrefix.Api}/${RoutePrefix.Users}/${UsersRoute.Me}`,
  probe: `/${RoutePrefix.Api}/${ProbeRoute.Undecorated}`,
  docs: `/${RoutePrefix.Docs}`,
};

type TestAppOptions = { throttling?: boolean; nodeEnv?: NodeEnv };

export const createTestApp = async ({
  throttling = false,
  nodeEnv = NodeEnv.Test,
}: TestAppOptions = {}) => {
  const mongo = await MongoMemoryServer.create();
  Object.assign(process.env, {
    NODE_ENV: nodeEnv,
    MONGODB_URI: mongo.getUri(),
    JWT_ACCESS_SECRET: JWT_SECRET,
    APP_ORIGIN,
    TRUST_PROXY_HOPS: '1',
  });
  const { AppModule } = await import('../src/app.module.js');
  const { configureApp } = await import('../src/app.setup.js');

  const builder = Test.createTestingModule({
    imports: [AppModule],
    controllers: [UndecoratedProbeController],
  });
  if (!throttling) {
    builder
      .overrideProvider(ThrottlerGuard)
      .useValue({ canActivate: () => true });
  }
  const moduleRef = await builder.compile();
  const app = configureApp(
    moduleRef.createNestApplication<NestExpressApplication>({
      bufferLogs: true,
    }),
  );
  await app.init();

  const users = app.get<Model<User>>(getModelToken(User.name));
  const sessions = app.get<Model<Session>>(getModelToken(Session.name));
  await Promise.all([users.init(), sessions.init()]);

  return {
    app,
    users,
    sessions,
    http: () => request(app.getHttpServer() as App),
    close: async () => {
      await app.close();
      await mongo.stop();
    },
  };
};

export type TestApp = Awaited<ReturnType<typeof createTestApp>>;

export const setCookies = (response: request.Response): string[] => {
  const header = response.headers['set-cookie'] as
    string[] | string | undefined;
  if (header === undefined) {
    return [];
  }
  return Array.isArray(header) ? header : [header];
};

export const setCookie = (response: request.Response, name: string) =>
  setCookies(response).find((cookie) => cookie.startsWith(`${name}=`));

export const cookieValue = (response: request.Response, name: string) =>
  setCookie(response, name)
    ?.split(';')[0]
    .slice(name.length + 1);

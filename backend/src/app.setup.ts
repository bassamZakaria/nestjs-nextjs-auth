import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { cookieNamesFor } from './auth/auth-cookies.js';
import { RoutePrefix } from './common/routes.js';
import { NodeEnv, type EnvironmentVariables } from './config/env.validation.js';

const setUpSwagger = (app: NestExpressApplication, nodeEnv: NodeEnv) => {
  const document = new DocumentBuilder()
    .setTitle('Auth API')
    .setVersion('1.0')
    .addCookieAuth(cookieNamesFor(nodeEnv).access)
    .build();
  SwaggerModule.setup(RoutePrefix.Docs, app, () =>
    SwaggerModule.createDocument(app, document),
  );
};

export const configureApp = (app: NestExpressApplication) => {
  const config = app.get(ConfigService<EnvironmentVariables, true>);
  const nodeEnv = config.get('NODE_ENV', { infer: true });

  app.useLogger(app.get(Logger));
  app.set('trust proxy', config.get('TRUST_PROXY_HOPS', { infer: true }));
  app.use(helmet());
  app.use(cookieParser());
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.setGlobalPrefix(RoutePrefix.Api);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();
  if (nodeEnv !== NodeEnv.Production) {
    setUpSwagger(app, nodeEnv);
  }
  return app;
};

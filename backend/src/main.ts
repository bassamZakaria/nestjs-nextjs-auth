import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import type { EnvironmentVariables } from './config/env.validation.js';

const app = configureApp(
  await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  }),
);
const config = app.get(ConfigService<EnvironmentVariables, true>);
await app.listen(
  config.get('PORT', { infer: true }),
  config.get('HOST', { infer: true }),
);

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { AppConfigService } from './config/env.validation.js';

const app = configureApp(
  await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  }),
);
const config = app.get(AppConfigService);
await app.listen(
  config.get('PORT', { infer: true }),
  config.get('HOST', { infer: true }),
);

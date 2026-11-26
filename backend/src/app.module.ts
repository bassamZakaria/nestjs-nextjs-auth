import { HttpStatus, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AuthGuard } from './auth/auth.guard.js';
import { AuthModule } from './auth/auth.module.js';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import { OriginGuard } from './common/origin.guard.js';
import { throttlerOptions } from './auth/throttling.js';
import type { Request } from 'express';
import {
  LogLevel,
  validateEnv,
  type AppConfigService,
} from './config/env.validation.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: AppConfigService) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL', { infer: true }),
          customProps: (request) => ({ clientIp: (request as Request).ip }),
          customLogLevel: (_request, response, error) =>
            error || response.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR
              ? LogLevel.Error
              : LogLevel.Info,
          redact: [
            'req.headers.cookie',
            'req.headers.authorization',
            'res.headers["set-cookie"]',
          ],
        },
      }),
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: AppConfigService) => ({
        uri: config.get('MONGODB_URI', { infer: true }),
      }),
    }),
    ThrottlerModule.forRoot(throttlerOptions),
    AuthModule,
    UsersModule,
  ],
  providers: [
    ThrottlerGuard,
    // Global guards run in this order: the throttler must count requests before AuthGuard can reject them.
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useExisting: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}

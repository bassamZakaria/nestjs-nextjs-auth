import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AuthGuard } from './auth/auth.guard.js';
import { AuthModule } from './auth/auth.module.js';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import { OriginGuard } from './common/origin.guard.js';
import { throttlerOptions } from './common/throttling.js';
import {
  NodeEnv,
  validateEnv,
  type EnvironmentVariables,
} from './config/env.validation.js';
import { UsersModule } from './users/users.module.js';

type Config = ConfigService<EnvironmentVariables, true>;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: Config) => ({
        pinoHttp: {
          level:
            config.get('NODE_ENV', { infer: true }) === NodeEnv.Test
              ? 'silent'
              : 'info',
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
      useFactory: (config: Config) => ({
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

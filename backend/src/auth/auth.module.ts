import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import type { AppConfigService } from '../config/env.validation.js';
import { UsersModule } from '../users/users.module.js';
import { jwtOptions } from './access-token.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PasswordHasher } from './password-hasher.service.js';
import { Session, SessionSchema } from './session.schema.js';
import { SessionsService } from './sessions.service.js';

@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([{ name: Session.name, schema: SessionSchema }]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: AppConfigService) =>
        jwtOptions(config.get('JWT_ACCESS_SECRET', { infer: true })),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, SessionsService, PasswordHasher],
  exports: [JwtModule],
})
export class AuthModule {}

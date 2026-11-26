import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AccessTokenPayload } from '../common/current-user-id.decorator.js';
import type { UserDocument } from '../users/user.schema.js';
import { UsersService } from '../users/users.service.js';
import type { IssuedTokens } from './auth-cookies.js';
import type { SignInDto } from './dto/sign-in.dto.js';
import type { SignUpDto } from './dto/sign-up.dto.js';
import { PasswordHasher } from './password-hasher.service.js';
import { SessionsService, type IssuedSession } from './sessions.service.js';

export enum AuthErrorMessage {
  InvalidCredentials = 'Invalid email or password',
}

export type AuthResult = { user: UserDocument; tokens: IssuedTokens };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
    private readonly passwords: PasswordHasher,
    private readonly jwt: JwtService,
  ) {}

  async signUp({ email, name, password }: SignUpDto): Promise<AuthResult> {
    const passwordHash = await this.passwords.hash(password);
    const user = await this.users.create({ email, name, passwordHash });
    this.logger.log({ userId: user.id }, 'User signed up');
    return this.startSession(user);
  }

  async signIn({ email, password }: SignInDto): Promise<AuthResult> {
    const user = await this.users.findByEmailWithPasswordHash(email);
    const isValid = user
      ? await this.passwords.verify(user.passwordHash, password)
      : await this.passwords.verifyAgainstDummy(password);
    if (!user || !isValid) {
      this.logger.warn('Sign-in failed');
      throw new UnauthorizedException(AuthErrorMessage.InvalidCredentials);
    }
    this.logger.log({ userId: user.id }, 'User signed in');
    return this.startSession(user);
  }

  async refresh(refreshToken: string | undefined): Promise<AuthResult | null> {
    const rotated = refreshToken
      ? await this.sessions.rotate(refreshToken)
      : null;
    if (!rotated) {
      return null;
    }
    const user = await this.users.findById(rotated.session.userId.toString());
    return user ? { user, tokens: await this.tokensFor(user, rotated) } : null;
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (refreshToken) {
      await this.sessions.revoke(refreshToken);
    }
  }

  private async startSession(user: UserDocument): Promise<AuthResult> {
    const issued = await this.sessions.create(user._id);
    return { user, tokens: await this.tokensFor(user, issued) };
  }

  private async tokensFor(
    user: UserDocument,
    { session, refreshToken }: IssuedSession,
  ): Promise<IssuedTokens> {
    const payload: AccessTokenPayload = { sub: user.id, sid: session.id };
    return {
      accessToken: await this.jwt.signAsync(payload),
      refreshToken,
      refreshExpiresAt: session.expiresAt,
    };
  }
}

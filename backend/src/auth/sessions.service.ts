import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types, type Model } from 'mongoose';
import { createHash, randomBytes } from 'node:crypto';
import { Session, type SessionDocument } from './session.schema.js';

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const SESSION_ID_PATTERN = /^[0-9a-f]{24}$/;
const SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/;

type ParsedRefreshToken = {
  sessionId: string;
  family: string;
  familyHash: string;
  tokenHash: string;
};

export type IssuedSession = { session: SessionDocument; refreshToken: string };

const newSecret = () => randomBytes(32).toString('base64url');

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

const parseRefreshToken = (token: string): ParsedRefreshToken | null => {
  const parts = token.split('.');
  const [sessionId, family, secret] = parts;
  if (
    parts.length !== 3 ||
    !SESSION_ID_PATTERN.test(sessionId) ||
    !SECRET_PATTERN.test(family) ||
    !SECRET_PATTERN.test(secret)
  ) {
    return null;
  }
  return {
    sessionId,
    family,
    familyHash: sha256(family),
    tokenHash: sha256(secret),
  };
};

@Injectable()
export class SessionsService implements OnModuleInit {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    @InjectModel(Session.name) private readonly sessions: Model<Session>,
  ) {}

  async onModuleInit() {
    await this.sessions.init();
  }

  async create(userId: Types.ObjectId): Promise<IssuedSession> {
    const family = newSecret();
    const secret = newSecret();
    const session = await this.sessions.create({
      userId,
      familyHash: sha256(family),
      tokenHash: sha256(secret),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });
    return { session, refreshToken: `${session.id}.${family}.${secret}` };
  }

  async rotate(refreshToken: string): Promise<IssuedSession | null> {
    const parsed = parseRefreshToken(refreshToken);
    if (!parsed) {
      return null;
    }
    const { sessionId, family, familyHash, tokenHash } = parsed;
    const secret = newSecret();
    const session = await this.sessions.findOneAndUpdate(
      { _id: sessionId, familyHash, tokenHash, expiresAt: { $gt: new Date() } },
      { $set: { tokenHash: sha256(secret) } },
      { returnDocument: 'after' },
    );
    if (session) {
      return { session, refreshToken: `${session.id}.${family}.${secret}` };
    }
    // Only a stale secret of the real family is theft: a guessed id must not revoke, an expired current secret is not a replay.
    const { deletedCount } = await this.sessions.deleteOne({
      _id: sessionId,
      familyHash,
      tokenHash: { $ne: tokenHash },
    });
    if (deletedCount > 0) {
      this.logger.warn(
        { sessionId },
        'Refresh token reuse detected, session revoked (possible token theft)',
      );
    }
    return null;
  }

  async revoke(refreshToken: string): Promise<void> {
    const parsed = parseRefreshToken(refreshToken);
    if (!parsed) {
      return;
    }
    const { sessionId, familyHash } = parsed;
    const { deletedCount } = await this.sessions.deleteOne({
      _id: sessionId,
      familyHash,
    });
    if (deletedCount > 0) {
      this.logger.log({ sessionId }, 'User logged out');
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types, type Model } from 'mongoose';
import { createHash, randomBytes } from 'node:crypto';
import { Session, type SessionDocument } from './session.schema.js';

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const SESSION_ID_PATTERN = /^[0-9a-f]{24}$/;
const SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/;

type ParsedRefreshToken = { sessionId: string; tokenHash: string };

export type IssuedSession = { session: SessionDocument; refreshToken: string };

const newSecret = () => randomBytes(32).toString('base64url');

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

const parseRefreshToken = (token: string): ParsedRefreshToken | null => {
  const [sessionId, secret, ...rest] = token.split('.');
  if (
    rest.length > 0 ||
    !SESSION_ID_PATTERN.test(sessionId) ||
    !SECRET_PATTERN.test(secret ?? '')
  ) {
    return null;
  }
  return { sessionId, tokenHash: sha256(secret) };
};

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    @InjectModel(Session.name) private readonly sessions: Model<Session>,
  ) {}

  async create(userId: Types.ObjectId): Promise<IssuedSession> {
    const secret = newSecret();
    const session = await this.sessions.create({
      userId,
      tokenHash: sha256(secret),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });
    return { session, refreshToken: `${session.id}.${secret}` };
  }

  async rotate(refreshToken: string): Promise<IssuedSession | null> {
    const parsed = parseRefreshToken(refreshToken);
    if (!parsed) {
      return null;
    }
    const secret = newSecret();
    const session = await this.sessions.findOneAndUpdate(
      {
        _id: parsed.sessionId,
        tokenHash: parsed.tokenHash,
        expiresAt: { $gt: new Date() },
      },
      { $set: { tokenHash: sha256(secret) } },
      { returnDocument: 'after' },
    );
    if (session) {
      return { session, refreshToken: `${session.id}.${secret}` };
    }
    await this.revokeIfReplayed(parsed);
    return null;
  }

  async revoke(refreshToken: string): Promise<void> {
    const parsed = parseRefreshToken(refreshToken);
    if (!parsed) {
      return;
    }
    await this.sessions.deleteOne({ _id: parsed.sessionId });
  }

  private async revokeIfReplayed({ sessionId, tokenHash }: ParsedRefreshToken) {
    const { deletedCount } = await this.sessions.deleteOne({
      _id: sessionId,
      tokenHash: { $ne: tokenHash },
    });
    if (deletedCount > 0) {
      this.logger.warn(
        { sessionId },
        'Refresh token reuse detected, session revoked (possible token theft)',
      );
    }
  }
}

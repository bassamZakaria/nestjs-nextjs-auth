import { Injectable, OnModuleInit } from '@nestjs/common';
import { argon2id, hash, verify, type HashOptions } from 'argon2';
import { randomBytes } from 'node:crypto';

const ARGON2_OPTIONS: HashOptions = {
  type: argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

@Injectable()
export class PasswordHasher implements OnModuleInit {
  private dummyHash: string;

  async onModuleInit() {
    this.dummyHash = await this.hash(randomBytes(32).toString('hex'));
  }

  hash(password: string) {
    return hash(password, ARGON2_OPTIONS);
  }

  verify(passwordHash: string, password: string) {
    return verify(passwordHash, password);
  }

  async verifyAgainstDummy(password: string) {
    await this.verify(this.dummyHash, password);
    return false;
  }
}

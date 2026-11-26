import {
  ConflictException,
  Injectable,
  type OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isObjectIdOrHexString, mongo, type Model } from 'mongoose';
import { User, type UserDocument } from './user.schema.js';

const DUPLICATE_KEY_ERROR = 11000;

export enum UsersErrorMessage {
  EmailTaken = 'Email is already registered',
}

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(@InjectModel(User.name) private readonly users: Model<User>) {}

  async onModuleInit() {
    await this.users.init();
  }

  async create(user: User): Promise<UserDocument> {
    try {
      return await this.users.create(user);
    } catch (error) {
      if (
        error instanceof mongo.MongoServerError &&
        error.code === DUPLICATE_KEY_ERROR
      ) {
        throw new ConflictException(UsersErrorMessage.EmailTaken);
      }
      throw error;
    }
  }

  findByEmailWithPasswordHash(email: string) {
    return this.users.findOne({ email }).select('+passwordHash').exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    if (!isObjectIdOrHexString(id)) {
      return null;
    }
    return this.users.findById(id).exec();
  }
}

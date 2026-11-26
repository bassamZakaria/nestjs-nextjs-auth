import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isObjectIdOrHexString, mongo, type Model } from 'mongoose';
import { User, type UserDocument } from './user.schema.js';

const DUPLICATE_KEY_ERROR = 11000;

export enum UsersErrorMessage {
  EmailTaken = 'Email is already registered',
}

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly users: Model<User>) {}

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

  findById(id: string) {
    return isObjectIdOrHexString(id) ? this.users.findById(id).exec() : null;
  }
}

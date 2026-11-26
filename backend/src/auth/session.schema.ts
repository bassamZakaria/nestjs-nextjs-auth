import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, type HydratedDocument } from 'mongoose';
import { User } from '../users/user.schema.js';

@Schema()
export class Session {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  familyHash: string;

  @Prop({ required: true })
  tokenHash: string;

  @Prop({ required: true, expires: 0 })
  expiresAt: Date;
}

export type SessionDocument = HydratedDocument<Session>;

export const SessionSchema = SchemaFactory.createForClass(Session);

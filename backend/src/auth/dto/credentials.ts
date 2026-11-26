import { Transform, type TransformFnParams } from 'class-transformer';
import { normaliseEmail } from '../../common/normalise-email.js';

export const EMAIL_MAX_LENGTH = 254;
export const NAME_MIN_LENGTH = 3;
export const NAME_MAX_LENGTH = 100;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const PASSWORD_LETTER = /\p{L}/u;
export const PASSWORD_DIGIT = /\d/;
export const PASSWORD_SPECIAL = /[^\p{L}\p{N}\s]/u;

export enum PasswordRuleMessage {
  Letter = 'password must contain a letter',
  Digit = 'password must contain a number',
  Special = 'password must contain a special character',
}

export const NormaliseEmail = () =>
  Transform(({ value }: TransformFnParams) => normaliseEmail(value));

export const Trim = () =>
  Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim() : value,
  );

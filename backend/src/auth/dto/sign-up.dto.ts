import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';
import {
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  NormaliseEmail,
  PASSWORD_DIGIT,
  PASSWORD_LETTER,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_SPECIAL,
  PasswordRuleMessage,
  Trim,
} from './credentials.js';

export class SignUpDto {
  @ApiProperty({ example: 'ada@example.com', maxLength: EMAIL_MAX_LENGTH })
  @NormaliseEmail()
  @IsString()
  @MaxLength(EMAIL_MAX_LENGTH)
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'Ada Lovelace',
    minLength: NAME_MIN_LENGTH,
    maxLength: NAME_MAX_LENGTH,
  })
  @Trim()
  @IsString()
  @Length(NAME_MIN_LENGTH, NAME_MAX_LENGTH)
  name: string;

  @ApiProperty({
    example: 'Analytical#1',
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
    description:
      'At least one letter, one digit and one character that is not a letter, digit or whitespace.',
  })
  @IsString()
  @Length(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH)
  @Matches(PASSWORD_LETTER, { message: PasswordRuleMessage.Letter })
  @Matches(PASSWORD_DIGIT, { message: PasswordRuleMessage.Digit })
  @Matches(PASSWORD_SPECIAL, { message: PasswordRuleMessage.Special })
  password: string;
}

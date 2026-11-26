import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import {
  EMAIL_MAX_LENGTH,
  NormaliseEmail,
  PASSWORD_MAX_LENGTH,
} from './credentials.js';

export class SignInDto {
  @ApiProperty({ example: 'ada@example.com', maxLength: EMAIL_MAX_LENGTH })
  @NormaliseEmail()
  @IsString()
  @MaxLength(EMAIL_MAX_LENGTH)
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Analytical#1', maxLength: PASSWORD_MAX_LENGTH })
  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSWORD_MAX_LENGTH)
  password: string;
}

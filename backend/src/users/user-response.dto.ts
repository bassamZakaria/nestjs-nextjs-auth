import { ApiProperty } from '@nestjs/swagger';
import type { UserDocument } from './user.schema.js';

export class UserResponseDto {
  @ApiProperty({ example: '665f1c2e9b1e8a3d4c5b6a79' })
  id: string;

  @ApiProperty({ example: 'ada@example.com' })
  email: string;

  @ApiProperty({ example: 'Ada Lovelace' })
  name: string;
}

export const toUserResponse = (user: UserDocument): UserResponseDto => ({
  id: user.id,
  email: user.email,
  name: user.name,
});

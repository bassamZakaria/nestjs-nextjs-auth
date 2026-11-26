import { Controller, Get, UnauthorizedException } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUserId } from '../auth/current-user-id.decorator.js';
import { RoutePrefix, UsersRoute } from '../common/routes.js';
import { toUserResponse, UserResponseDto } from './user-response.dto.js';
import { UsersService } from './users.service.js';

@ApiTags(RoutePrefix.Users)
@ApiCookieAuth()
@Controller(RoutePrefix.Users)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get(UsersRoute.Me)
  @ApiOkResponse({ type: UserResponseDto })
  @ApiUnauthorizedResponse()
  async me(@CurrentUserId() userId: string): Promise<UserResponseDto> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }
    return toUserResponse(user);
  }
}

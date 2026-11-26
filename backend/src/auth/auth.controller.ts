import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../common/public.decorator.js';
import { AuthRoute, RoutePrefix } from '../common/routes.js';
import { STRICT_LIMITS, ThrottlerName } from '../common/throttling.js';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { toUserResponse, UserResponseDto } from '../users/user-response.dto.js';
import {
  clearAuthCookies,
  cookieNamesFor,
  readCookie,
  setAuthCookies,
} from './auth-cookies.js';
import { AuthService, type AuthResult } from './auth.service.js';
import { SignInDto } from './dto/sign-in.dto.js';
import { SignUpDto } from './dto/sign-up.dto.js';

@ApiTags(RoutePrefix.Auth)
@Public()
@Controller(RoutePrefix.Auth)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  @Post(AuthRoute.SignUp)
  @Throttle(STRICT_LIMITS.signUp)
  @SkipThrottle({ [ThrottlerName.SignInEmail]: true })
  @ApiCreatedResponse({ type: UserResponseDto })
  @ApiBadRequestResponse()
  @ApiConflictResponse()
  @ApiTooManyRequestsResponse()
  async signUp(
    @Body() dto: SignUpDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserResponseDto> {
    return this.respond(response, await this.auth.signUp(dto));
  }

  @Post(AuthRoute.SignIn)
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT_LIMITS.signIn)
  @ApiOkResponse({ type: UserResponseDto })
  @ApiBadRequestResponse()
  @ApiUnauthorizedResponse()
  @ApiTooManyRequestsResponse()
  async signIn(
    @Body() dto: SignInDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserResponseDto> {
    return this.respond(response, await this.auth.signIn(dto));
  }

  @Post(AuthRoute.Refresh)
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT_LIMITS.refresh)
  @ApiOkResponse({ type: UserResponseDto })
  @ApiUnauthorizedResponse()
  @ApiTooManyRequestsResponse()
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserResponseDto> {
    const result = await this.auth.refresh(this.refreshCookie(request));
    if (!result) {
      clearAuthCookies(response, this.nodeEnv);
      throw new UnauthorizedException();
    }
    return this.respond(response, result);
  }

  @Post(AuthRoute.Logout)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(this.refreshCookie(request));
    clearAuthCookies(response, this.nodeEnv);
  }

  private get nodeEnv() {
    return this.config.get('NODE_ENV', { infer: true });
  }

  private refreshCookie(request: Request) {
    return readCookie(request, cookieNamesFor(this.nodeEnv).refresh);
  }

  private respond(response: Response, { user, tokens }: AuthResult) {
    setAuthCookies(response, this.nodeEnv, tokens);
    return toUserResponse(user);
  }
}

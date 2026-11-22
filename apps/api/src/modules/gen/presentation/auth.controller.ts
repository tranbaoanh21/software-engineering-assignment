import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { object, text } from '../../../shared/http/input.js';
import { SETTINGS, type Settings } from '../../../config/settings.js';
import { AccessService } from '../application/access.service.js';
import { sessionCookieName } from '../domain/session.js';
import { AccessGuard, assertOrigin, getSessionCookie, type SessionRequest } from './access.guard.js';
import { LoginThrottle } from './login-throttle.service.js';

@Controller('auth')
export class AuthController {
  private readonly cookie: CookieOptions;

  constructor(
    private readonly access: AccessService,
    private readonly throttle: LoginThrottle,
    @Inject(SETTINGS) private readonly settings: Settings,
  ) {
    this.cookie = { httpOnly: true, sameSite: 'lax', secure: settings.secureCookie, path: '/' };
  }

  @Post('register')
  register(@Req() request: Request, @Body() input: unknown) {
    assertOrigin(request, this.settings.origin);
    const body = object(input);
    const username = text(body.username, 'mã số sinh viên', 50, 3).toLowerCase();
    const displayName = text(body.displayName, 'họ và tên', 100);
    if (!/^[0-9]{3,50}$/.test(username)) {
      throw new BadRequestException('Mã số sinh viên không hợp lệ.');
    }
    if (typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 256) {
      throw new BadRequestException('Mật khẩu phải dài từ 12 đến 256 ký tự.');
    }
    this.throttle.checkRegistration(request.ip ?? 'local');
    return this.access.registerStudent(username, displayName, body.password);
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() input: unknown,
  ) {
    assertOrigin(request, this.settings.origin);
    if (!input || typeof input !== 'object' || !('username' in input) || !('password' in input)) {
      throw new BadRequestException('Vui lòng nhập tên đăng nhập và mật khẩu');
    }

    const username = typeof input.username === 'string' ? input.username.trim().toLowerCase() : '';
    const password = typeof input.password === 'string' ? input.password : '';
    if (!/^[a-z0-9._@-]{1,100}$/.test(username) || !password || password.length > 256) {
      throw new BadRequestException('Thông tin đăng nhập không hợp lệ');
    }

    this.throttle.check(request.ip ?? 'local', username);
    const { token, session } = await this.access.login(username, password);
    response.setHeader('Cache-Control', 'no-store');
    response.cookie(sessionCookieName, token, this.cookie);
    return session;
  }

  @Get('me')
  @UseGuards(AccessGuard)
  me(@Req() request: SessionRequest, @Res({ passthrough: true }) response: Response) {
    response.setHeader('Cache-Control', 'no-store');
    return request.sessionView;
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    assertOrigin(request, this.settings.origin);
    const token = getSessionCookie(request);
    if (token) {
      this.access.assertCsrf(token, request.get('x-csrf-token'));
      await this.access.logout(token);
    }
    response.clearCookie(sessionCookieName, this.cookie);
  }
}

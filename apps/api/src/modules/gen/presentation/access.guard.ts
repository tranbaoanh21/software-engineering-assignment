import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role, SessionView } from '@semh/contracts';
import type { Request } from 'express';
import { SETTINGS, type Settings } from '../../../config/settings.js';
import { AccessService } from '../application/access.service.js';
import { sessionCookieName } from '../domain/session.js';

const allowedRoles = Symbol('AllowedRoles');
export const Roles = (...roles: Role[]) => SetMetadata(allowedRoles, roles);

export interface SessionRequest extends Request {
  sessionView: SessionView;
  sessionToken: string;
}

export function getSessionCookie(request: Request): string | undefined {
  const token: unknown = request.cookies?.[sessionCookieName];
  return typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : undefined;
}

export function assertOrigin(request: Request, expected: string) {
  if (request.get('origin') !== expected) throw new ForbiddenException('Nguồn yêu cầu không hợp lệ');
}

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly access: AccessService,
    private readonly reflector: Reflector,
    @Inject(SETTINGS) private readonly settings: Settings,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<SessionRequest>();
    const token = getSessionCookie(request);
    if (!token) throw new UnauthorizedException('Vui lòng đăng nhập');

    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      assertOrigin(request, this.settings.origin);
      this.access.assertCsrf(token, request.get('x-csrf-token'));
    }

    const roles = this.reflector.getAllAndOverride<Role[]>(allowedRoles, [
      context.getHandler(),
      context.getClass(),
    ]);
    request.sessionView = await this.access.verifyAccess(token, roles);
    request.sessionToken = token;
    return true;
  }
}

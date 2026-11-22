import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { ConflictException, ForbiddenException, Injectable, UnauthorizedException, type OnModuleInit } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import type { Role, SessionView } from '@semh/contracts';
import { AccessStore, type AccountAccess } from './access-store.port.js';
import type { Transaction } from '../../../shared/database/transaction.js';
import { sessionIdleMs } from '../domain/session.js';

function digest(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function csrfFor(token: string) {
  return createHmac('sha256', token).update('semh-session-csrf').digest('base64url');
}

function denied(): UnauthorizedException {
  return new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng');
}

@Injectable()
export class AccessService implements OnModuleInit {
  private dummyHash = '';

  constructor(private readonly store: AccessStore) {}

  async onModuleInit() {
    this.dummyHash = await hash(randomBytes(24).toString('hex'));
  }

  async registerStudent(username: string, displayName: string, password: string) {
    const created = await this.store.createStudent({ username, displayName, passwordHash: await hash(password) });
    if (!created) throw new ConflictException('Mã số sinh viên này đã được đăng ký.');
    return { username };
  }

  async login(username: string, password: string) {
    const account = await this.store.findAccount(username);
    const valid = await verify(account?.passwordHash ?? this.dummyHash, password);
    if (!valid || !account || account.status !== 'ACTIVE' || account.assignments.length === 0) throw denied();

    const token = randomBytes(32).toString('base64url');
    await this.store.createSession(account.id, digest(token));
    return { token, session: this.toSession(account, token) };
  }

  async verifyAccess(token: string, roles: readonly Role[] = [], tx?: Transaction): Promise<SessionView> {
    const now = new Date();
    const cutoff = new Date(now.getTime() - sessionIdleMs);
    const entry = await this.store.findSession(digest(token), tx);
    if (!entry || entry.revokedAt || entry.lastActiveAt <= cutoff || entry.account.status !== 'ACTIVE') {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hiệu lực');
    }

    const session = this.toSession(entry.account, token);
    if (!session.roles.length || (roles.length && !roles.some(role => session.roles.includes(role)))) {
      throw new ForbiddenException('Tài khoản không có quyền thực hiện thao tác');
    }

    if (!tx && !await this.store.touchSession(entry.id, cutoff, now)) {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hiệu lực');
    }
    return session;
  }

  assertCsrf(token: string, supplied: string | undefined) {
    const expected = Buffer.from(csrfFor(token));
    const candidate = Buffer.from(supplied ?? '');
    if (expected.length !== candidate.length || !timingSafeEqual(expected, candidate)) {
      throw new ForbiddenException('Yêu cầu không hợp lệ');
    }
  }

  async logout(token: string) {
    await this.store.revokeSession(digest(token), new Date());
  }

  private toSession(account: AccountAccess, token: string): SessionView {
    const operator = account.assignments.find(assignment => assignment.role === 'OPR');
    return {
      accountId: account.id,
      displayName: account.displayName,
      roles: account.assignments.map(assignment => assignment.role),
      csrfToken: csrfFor(token),
      operatorHubIds: operator && (operator.allHubs ? null : operator.hubIds),
    };
  }
}

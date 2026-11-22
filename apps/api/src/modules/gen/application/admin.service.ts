import { createHmac } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import type { AccountView, ChangeInput, Role } from '@semh/contracts';
import { AuditService } from '../../../shared/audit/audit.service.js';
import { withChange } from '../../../shared/database/change-receipt.js';
import type { Transaction } from '../../../shared/database/transaction.js';
import { assertVersion } from '../../../shared/http/input.js';
import { PrismaAdminStore } from '../infrastructure/prisma-admin.store.js';
import { AccessService } from './access.service.js';

@Injectable()
export class AdminService {
  constructor(private readonly access: AccessService, private readonly store: PrismaAdminStore, private readonly audit: AuditService,
  ) {}

  list() {
    return this.store.list();
  }

  async create(token: string, input: { username: string; displayName: string; password: string }, change: ChangeInput) {
    if (!/^[a-z0-9][a-z0-9._-]{2,49}$/.test(input.username)) throw new BadRequestException('Tên đăng nhập không hợp lệ.');
    const passwordHash = await hash(input.password);
    const credentialProof = createHmac('sha256', token).update('account-create:').update(input.password).digest('hex');
    return this.store.inTransaction(async tx => {
      const { accountId } = await this.access.verifyAccess(token, ['ADM'], tx);
      return withChange(tx, accountId, 'ACCOUNT_CREATED', change, { username: input.username, displayName: input.displayName, credentialProof }, async () => {
        const account = await this.store.create(tx, { username: input.username, displayName: input.displayName, passwordHash });
        await this.log(tx, accountId, 'ACCOUNT_CREATED', change, account, null);
        return account;
      });
    });
  }

  update(token: string, id: string, patch: { displayName?: string; status?: AccountView['status'] }, change: ChangeInput) {
    return this.command(token, id, 'ACCOUNT_UPDATED', patch, change, async (tx, record) => {
      if (patch.status === 'LOCKED') await this.protectLastAdmin(tx, record);
      return this.store.update(tx, id, patch);
    });
  }

  assign(token: string, id: string, input: { role: Role; grant: boolean; allHubs: boolean; hubIds: string[] }, change: ChangeInput) {
    return this.command(token, id, 'ACCOUNT_ROLE_CHANGED', input, change, async (tx, record) => {
      if (input.role === 'ADM' && !input.grant) await this.protectLastAdmin(tx, record);
      if (!await this.store.hubsExist(tx, input.hubIds)) throw new BadRequestException('Có Hub không tồn tại.');
      return this.store.assign(tx, id, input.role, input.grant, input.allHubs, input.hubIds);
    });
  }

  private async protectLastAdmin(tx: Transaction, record: AccountView) {
    if (record.status === 'ACTIVE' && record.assignments.some(item => item.role === 'ADM') &&
        await this.store.countActiveAdmins(tx) <= 1) {
      throw new ConflictException('Phải giữ ít nhất một quản trị viên đang hoạt động.');
    }
  }

  private command(
    token: string, id: string, action: string, input: object, change: ChangeInput,
    execute: (tx: Transaction, record: AccountView) => Promise<AccountView>,
  ) {
    return this.store.inTransaction(async tx => {
      const { accountId } = await this.access.verifyAccess(token, ['ADM'], tx);
      return withChange(tx, accountId, action, change, { id, input }, async () => {
        const current = await this.store.read(tx, id);
        if (!current) throw new NotFoundException('Không tìm thấy tài khoản.');
        assertVersion(current.version, change.version);
        const account = await execute(tx, current);
        await this.log(tx, accountId, action, change, account, current);
        return account;
      });
    });
  }

  private log(tx: Transaction, actorId: string, action: string, change: ChangeInput, after: AccountView, before: AccountView | null) {
    return this.audit.append(tx, {
      actorId, action, targetType: 'account', targetId: after.id, requestId: change.requestId, occurredAt: new Date(),
      details: { reason: change.reason ?? null, before: before && { ...before }, after: { ...after } },
    });
  }
}

import { Injectable } from '@nestjs/common';
import type { AccountView, Role } from '@semh/contracts';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import { runSerializable } from '../../../shared/database/serializable.js';
import type { Transaction } from '../../../shared/database/transaction.js';
import { studentAccountData } from './prisma-access.store.js';
import type { StudentAccountCredentials } from '../application/access-store.port.js';

const summary = {
  id: true, username: true, displayName: true, status: true, version: true,
  assignments: { orderBy: { role: 'asc' as const }, select: { role: true, allHubs: true, hubIds: true } },
} as const;

@Injectable()
export class PrismaAdminStore {
  constructor(private readonly prisma: PrismaService) {}

  inTransaction<T>(work: (tx: Transaction) => Promise<T>) {
    return runSerializable(this.prisma, work);
  }

  list(): Promise<AccountView[]> {
    return this.prisma.account.findMany({ select: summary, orderBy: { username: 'asc' } });
  }

  read(tx: Transaction, id: string): Promise<AccountView | null> {
    return tx.account.findUnique({ where: { id }, select: summary });
  }

  create(tx: Transaction, data: StudentAccountCredentials) {
    return tx.account.create({
      data: studentAccountData(data), select: summary,
    });
  }

  async update(tx: Transaction, id: string, data: { displayName?: string; status?: AccountView['status'] }) {
    if (data.status === 'LOCKED') {
      await tx.session.updateMany({ where: { accountId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    return tx.account.update({ where: { id }, data: { ...data, version: { increment: 1 } }, select: summary });
  }

  async countActiveAdmins(tx: Transaction) {
    return tx.account.count({ where: { status: 'ACTIVE', assignments: { some: { role: 'ADM' } } } });
  }

  async hubsExist(tx: Transaction, ids: string[]) {
    return await tx.mobilityHub.count({ where: { id: { in: ids } } }) === ids.length;
  }

  async assign(tx: Transaction, id: string, role: Role, grant: boolean, allHubs: boolean, hubIds: string[]) {
    if (grant) {
      await tx.accessAssignment.upsert({
        where: { accountId_role: { accountId: id, role } },
        create: { accountId: id, role, allHubs, hubIds },
        update: { allHubs, hubIds },
      });
    } else {
      await tx.accessAssignment.deleteMany({ where: { accountId: id, role } });
    }
    return this.update(tx, id, {});
  }
}

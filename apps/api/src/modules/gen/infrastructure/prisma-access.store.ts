import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import type { Transaction } from '../../../shared/database/transaction.js';
import { Prisma } from '../../../generated/prisma/client.js';
import { AccessStore, type StudentAccountCredentials } from '../application/access-store.port.js';

const accountSelect = {
  id: true,
  displayName: true,
  status: true,
  assignments: { select: { role: true, allHubs: true, hubIds: true } },
} as const;

export function studentAccountData(data: StudentAccountCredentials) {
  return { ...data, assignments: { create: { role: 'STU' as const } } };
}

@Injectable()
export class PrismaAccessStore extends AccessStore {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async createStudent(data: StudentAccountCredentials) {
    try {
      await this.prisma.account.create({ data: studentAccountData(data), select: { id: true } });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return false;
      throw error;
    }
  }

  findAccount(username: string) {
    return this.prisma.account.findUnique({
      where: { username },
      select: { ...accountSelect, passwordHash: true },
    });
  }

  async createSession(accountId: string, tokenHash: string) {
    await this.prisma.session.create({ data: { accountId, tokenHash } });
  }

  findSession(tokenHash: string, tx: Transaction = this.prisma) {
    return tx.session.findUnique({
      where: { tokenHash },
      include: { account: { select: accountSelect } },
    });
  }

  async touchSession(sessionId: string, cutoff: Date, now: Date) {
    const result = await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null, lastActiveAt: { gt: cutoff }, account: { status: 'ACTIVE' } },
      data: { lastActiveAt: now },
    });
    return result.count > 0;
  }

  async revokeSession(tokenHash: string, now: Date) {
    await this.prisma.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: now },
    });
  }
}

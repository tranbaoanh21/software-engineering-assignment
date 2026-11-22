import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { Transaction } from '../database/transaction.js';

type AuditWrite = Omit<Prisma.AuditEntryUncheckedCreateInput, 'id'>;

@Injectable()
export class AuditService {
  async append(tx: Transaction, entry: AuditWrite) {
    await tx.auditEntry.create({ data: entry });
  }
}

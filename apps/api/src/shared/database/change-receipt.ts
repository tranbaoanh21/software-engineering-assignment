import { createHash } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import type { ChangeInput } from '@semh/contracts';
import type { Prisma } from '../../generated/prisma/client.js';
import type { Transaction } from './transaction.js';

export async function withChange<T>(
  tx: Transaction, actorId: string, action: string, change: ChangeInput, input: unknown, execute: () => Promise<T>,
): Promise<T> {
  const fingerprint = createHash('sha256').update(JSON.stringify({ input, reason: change.reason, version: change.version })).digest('hex');
  const key = { actorId, requestId: change.requestId };
  const previous = await tx.changeReceipt.findUnique({ where: { actorId_requestId: key } });
  if (previous) {
    if (previous.action !== action || previous.fingerprint !== fingerprint) {
      throw new ConflictException('Mã yêu cầu đã được dùng với nội dung khác.');
    }
    return previous.response as T;
  }
  const result = await execute();
  const response = JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue;
  await tx.changeReceipt.create({ data: { ...key, action, fingerprint, response } });
  return result;
}

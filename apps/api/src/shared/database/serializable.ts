import { ConflictException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import type { PrismaService } from './prisma.service.js';
import type { Transaction } from './transaction.js';
import { collectLiveChanges, committedChanges, type LiveChange } from '../live/committed-changes.js';

export async function runSerializable<T>(prisma: PrismaService, work: (tx: Transaction) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const changes = new Map<string, LiveChange>();
    let result: T;
    try {
      result = await prisma.$transaction(tx => collectLiveChanges(tx, changes, work), { isolationLevel: 'Serializable' });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || !['P2034', 'P2002'].includes(error.code)) throw error;
      if (attempt >= 2) {
        throw new ConflictException({ code: 'RESOURCE_CONFLICT', message: 'Tài nguyên vừa thay đổi. Vui lòng kiểm tra lại.' });
      }
      continue;
    }
    if (changes.size) committedChanges.emit('change', [...changes.values()]);
    return result;
  }
}

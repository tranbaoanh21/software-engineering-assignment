import { ConflictException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import type { PrismaService } from './prisma.service.js';
import type { Transaction } from './transaction.js';

export async function runSerializable<T>(prisma: PrismaService, work: (tx: Transaction) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(work, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || !['P2034', 'P2002'].includes(error.code)) throw error;
      if (attempt >= 2) {
        throw new ConflictException({ code: 'RESOURCE_CONFLICT', message: 'Tài nguyên vừa thay đổi. Vui lòng kiểm tra lại.' });
      }
    }
  }
}

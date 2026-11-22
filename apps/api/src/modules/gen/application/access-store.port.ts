import type { Role } from '@semh/contracts';
import type { Transaction } from '../../../shared/database/transaction.js';

export interface AccountAccess {
  id: string;
  displayName: string;
  status: 'ACTIVE' | 'LOCKED';
  assignments: { role: Role; allHubs: boolean; hubIds: string[] }[];
}

export interface StudentAccountCredentials {
  username: string;
  displayName: string;
  passwordHash: string;
}

export abstract class AccessStore {
  abstract createStudent(data: StudentAccountCredentials): Promise<boolean>;
  abstract findAccount(username: string): Promise<(AccountAccess & { passwordHash: string }) | null>;
  abstract createSession(accountId: string, tokenHash: string): Promise<void>;
  abstract findSession(tokenHash: string, tx?: Transaction): Promise<{
    id: string;
    lastActiveAt: Date;
    revokedAt: Date | null;
    account: AccountAccess;
  } | null>;
  abstract touchSession(sessionId: string, cutoff: Date, now: Date): Promise<boolean>;
  abstract revokeSession(tokenHash: string, now: Date): Promise<void>;
}

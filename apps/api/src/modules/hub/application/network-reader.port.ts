import type { NetworkHub } from '@semh/contracts';
import type { Transaction } from '../../../shared/database/transaction.js';

export abstract class NetworkReader {
  abstract snapshot(hubIds?: string[], activeOnly?: boolean): Promise<NetworkHub[]>;
  abstract read(tx: Transaction, hubIds?: string[], activeOnly?: boolean): Promise<NetworkHub[]>;
}

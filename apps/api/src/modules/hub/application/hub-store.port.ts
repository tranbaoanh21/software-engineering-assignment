import type { HubView } from '@semh/contracts';
import type { Transaction } from '../../../shared/database/transaction.js';

export abstract class HubStore {
  abstract isHubActiveInTx(tx: Transaction, hubId: string): Promise<boolean>;
  abstract readArrivalCapacity(tx: Transaction, hubId: string): Promise<{ active: boolean; spaces: number; physicalSpaces: number } | null>;
  abstract listActiveHubs(): Promise<HubView[]>;
}

import { Injectable } from '@nestjs/common';
import type { Transaction } from '../../../shared/database/transaction.js';
import { HubStore } from './hub-store.port.js';

@Injectable()
export class HubService {
  constructor(private readonly store: HubStore) {}

  isHubActiveInTx(tx: Transaction, hubId: string) {
    return this.store.isHubActiveInTx(tx, hubId);
  }

  readArrivalCapacityInTx(tx: Transaction, hubId: string) {
    return this.store.readArrivalCapacity(tx, hubId);
  }

  list() {
    return this.store.listActiveHubs();
  }
}

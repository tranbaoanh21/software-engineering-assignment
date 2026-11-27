import { EventEmitter } from 'node:events';
import type { LiveTopic } from '@semh/contracts';
import type { Transaction } from '../database/transaction.js';

export interface LiveChange {
  topic: LiveTopic;
  hubId: string | null;
}

const pending = new WeakMap<Transaction, Map<string, LiveChange>>();
export const committedChanges = new EventEmitter<{ change: [readonly LiveChange[]] }>();

export async function collectLiveChanges<T>(
  tx: Transaction, changes: Map<string, LiveChange>, work: (tx: Transaction) => Promise<T>,
): Promise<T> {
  pending.set(tx, changes);
  try {
    return await work(tx);
  } finally {
    pending.delete(tx);
  }
}

export function markLiveChange(tx: Transaction, topic: LiveTopic, hubId: string | null) {
  pending.get(tx)?.set(topic + ':' + (hubId ?? ''), { topic, hubId });
}

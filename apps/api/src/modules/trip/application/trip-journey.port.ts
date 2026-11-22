import type { PendingTripHandoff, TripView } from '@semh/contracts';
import type { Transaction } from '../../../shared/database/transaction.js';

export type HandoffKind = PendingTripHandoff['kind'];
export interface HandoffRecord {
  id: string;
  kind: HandoffKind;
  status: 'PENDING' | 'APPLIED' | 'REJECTED';
  studentId: string;
  subjectId: string;
  vehicleId: string;
  hubId: string;
  createdAt: Date;
  expiresAt: Date;
  reason: string | null;
  vehicle: { sourceId: string; fault: boolean; code: string; serviceStatus: string; status: string };
}
export type HandoffInput = Pick<HandoffRecord, 'kind' | 'studentId' | 'subjectId' | 'vehicleId' | 'hubId' | 'createdAt' | 'expiresAt'> & {
  requestId: string;
};

export type TripRecord = Omit<TripView, 'startedAt' | 'endedAt'> & {
  startedAt: Date;
  endedAt: Date | null;
};

export type TripFinish = {
  hubId: string;
  at: Date;
  battery: number;
  vehicleStatus: 'AVAILABLE' | 'AWAITING_CHARGE' | 'OUT_OF_SERVICE';
};

export abstract class TripJourneyStore {
  abstract serializable<T>(work: (tx: Transaction) => Promise<T>): Promise<T>;
  abstract byRequest(tx: Transaction, studentId: string, requestId: string): Promise<HandoffRecord | null>;
  abstract pending(tx: Transaction, studentId: string, kind: HandoffKind, subjectId: string, now: Date): Promise<HandoffRecord | null>;
  abstract createHandoff(tx: Transaction, data: HandoffInput): Promise<HandoffRecord>;
  abstract handoff(id: string, tx?: Transaction): Promise<HandoffRecord | null>;
  abstract listPending(sourceId: string, now: Date): Promise<PendingTripHandoff[]>;
  abstract recordEvent(tx: Transaction, sourceId: string, eventId: string): Promise<boolean>;
  abstract recordOutcome(tx: Transaction, commandId: string, outcome: { tripId: string } | { reason: string }): Promise<void>;
  abstract findTrip(studentId: string, tripId: string, tx: Transaction): Promise<TripRecord | null>;
  abstract listTrips(studentId: string): Promise<TripRecord[]>;
  abstract start(tx: Transaction, command: HandoffRecord, at: Date, battery: number): Promise<string>;
  abstract finish(tx: Transaction, trip: TripRecord, end: TripFinish): Promise<void>;
}

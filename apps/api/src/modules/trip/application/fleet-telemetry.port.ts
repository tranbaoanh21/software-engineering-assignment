import type { BatteryStateEvent, StateEventReceipt } from '@semh/contracts';

export abstract class FleetTelemetryStore {
  abstract applyBatteryEvent(event: BatteryStateEvent): Promise<StateEventReceipt>;
}

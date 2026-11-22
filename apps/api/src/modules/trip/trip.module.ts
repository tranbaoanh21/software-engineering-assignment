import { FleetNetwork } from './application/fleet-network.port.js';
import { PrismaFleetNetworkStore } from './infrastructure/prisma-fleet-network.store.js';
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module.js';
import { FleetTelemetryStore } from './application/fleet-telemetry.port.js';
import { VehicleHoldStore } from './application/vehicle-hold.port.js';
import { PrismaVehicleHoldStore } from './infrastructure/prisma-vehicle-hold.store.js';
import { TripService } from './application/trip.service.js';
import { PrismaFleetTelemetryStore } from './infrastructure/prisma-fleet-telemetry.store.js';

@Module({
  imports: [DatabaseModule],
  providers: [
    TripService, { provide: FleetNetwork, useClass: PrismaFleetNetworkStore },
    { provide: FleetTelemetryStore, useClass: PrismaFleetTelemetryStore },
    { provide: VehicleHoldStore, useClass: PrismaVehicleHoldStore },
  ],
  exports: [TripService, FleetNetwork],
})
export class TripModule {}

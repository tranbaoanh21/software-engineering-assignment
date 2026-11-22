import { PrivateCharging } from './application/private-charging.port.js';
import { PrismaParkingNetworkStore } from './infrastructure/prisma-parking-network.store.js';
import { Module } from '@nestjs/common';
import { AuditModule } from '../../shared/audit/audit.module.js';
import { DatabaseModule } from '../../shared/database/database.module.js';
import { GenModule } from '../gen/gen.module.js';
import { HubModule } from '../hub/hub.module.js';
import { ParkingStore } from './application/parking-store.port.js';
import { ParkingService } from './application/parking.service.js';
import { ParkingExpiryScheduler } from './infrastructure/parking-expiry.scheduler.js';
import { PrismaParkingStore } from './infrastructure/prisma-parking.store.js';
import { ParkingController } from './presentation/parking.controller.js';

@Module({
  imports: [DatabaseModule, AuditModule, GenModule, HubModule],
  controllers: [ParkingController],
  providers: [ParkingService, { provide: PrivateCharging, useClass: PrismaParkingNetworkStore }, ParkingExpiryScheduler, { provide: ParkingStore, useClass: PrismaParkingStore }],
  exports: [ParkingService, PrivateCharging],
})
export class ParkModule {}

import { Module } from '@nestjs/common';
import { AuditModule } from '../../shared/audit/audit.module.js';
import { DatabaseModule } from '../../shared/database/database.module.js';
import { GenModule } from '../gen/gen.module.js';
import { ParkModule } from '../park/park.module.js';
import { TripModule } from '../trip/trip.module.js';
import { ChargingService } from './application/charging.service.js';
import { ChargingScheduler } from './infrastructure/charging.scheduler.js';
import { OwnerChargingContextAdapter } from './infrastructure/owner-charging-context.adapter.js';
import { PrismaChargingStore } from './infrastructure/prisma-charging.store.js';
import { ChargingController } from './presentation/charging.controller.js';

@Module({
  imports: [AuditModule, DatabaseModule, GenModule, ParkModule, TripModule],
  controllers: [ChargingController],
  providers: [ChargingService, PrismaChargingStore, OwnerChargingContextAdapter, ChargingScheduler],
  exports: [ChargingService],
})
export class ChgModule {}

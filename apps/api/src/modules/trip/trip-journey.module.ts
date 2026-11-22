import { Module } from '@nestjs/common';
import { AuditModule } from '../../shared/audit/audit.module.js';
import { DatabaseModule } from '../../shared/database/database.module.js';
import { GenModule } from '../gen/gen.module.js';
import { HubModule } from '../hub/hub.module.js';
import { ResModule } from '../res/res.module.js';
import { TripJourneyStore } from './application/trip-journey.port.js';
import { TripJourneyService } from './application/trip-journey.service.js';
import { PrismaTripJourneyStore } from './infrastructure/prisma-trip-journey.store.js';
import { TripController } from './presentation/trip.controller.js';
import { TripModule } from './trip.module.js';

@Module({
  imports: [AuditModule, DatabaseModule, GenModule, HubModule, ResModule, TripModule],
  controllers: [TripController],
  providers: [TripJourneyService, { provide: TripJourneyStore, useClass: PrismaTripJourneyStore }],
  exports: [TripJourneyService],
})
export class TripJourneyModule {}

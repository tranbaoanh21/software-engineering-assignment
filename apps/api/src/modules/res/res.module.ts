import { Module } from '@nestjs/common';
import { AuditModule } from '../../shared/audit/audit.module.js';
import { DatabaseModule } from '../../shared/database/database.module.js';
import { GenModule } from '../gen/gen.module.js';
import { TripModule } from '../trip/trip.module.js';
import { ReservationStore } from './application/reservation-store.port.js';
import { ReservationService } from './application/reservation.service.js';
import { PrismaReservationStore } from './infrastructure/prisma-reservation.store.js';
import { ReservationExpiryScheduler } from './infrastructure/reservation-expiry.scheduler.js';
import { ReservationController } from './presentation/reservation.controller.js';

@Module({
  imports: [DatabaseModule, AuditModule, GenModule, TripModule],
  controllers: [ReservationController],
  providers: [
    ReservationService,
    ReservationExpiryScheduler,
    { provide: ReservationStore, useClass: PrismaReservationStore },
  ],
  exports: [ReservationService],
})
export class ResModule {}

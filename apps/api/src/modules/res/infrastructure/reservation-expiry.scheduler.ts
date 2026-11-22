import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ReservationService } from '../application/reservation.service.js';

@Injectable()
export class ReservationExpiryScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(ReservationExpiryScheduler.name);
  private timer?: NodeJS.Timeout;
  private sweep?: Promise<void>;

  constructor(private readonly reservations: ReservationService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      if (this.sweep) return;
      this.sweep = this.reservations.expireDueReservations()
        .catch(error => this.log.error('Reservation expiry failed', error))
        .finally(() => { this.sweep = undefined; });
    }, 30_000);
    this.timer.unref();
  }

  async onModuleDestroy() {
    clearInterval(this.timer);
    await this.sweep;
  }
}

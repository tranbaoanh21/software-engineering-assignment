import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ParkingService } from '../application/parking.service.js';

@Injectable()
export class ParkingExpiryScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(ParkingExpiryScheduler.name);
  private timer?: NodeJS.Timeout;
  private sweep?: Promise<void>;

  constructor(private readonly parking: ParkingService) {}

  onModuleInit() {
    const scan = () => {
      if (this.sweep) return;
      this.sweep = this.parking.expireDueReservations()
        .catch(error => this.log.error('Parking expiry failed', error))
        .finally(() => { this.sweep = undefined; });
    };
    scan();
    this.timer = setInterval(scan, 30_000);
    this.timer.unref();
  }

  async onModuleDestroy() {
    clearInterval(this.timer);
    await this.sweep;
  }
}

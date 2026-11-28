import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ChargingService } from '../application/charging.service.js';

@Injectable()
export class ChargingScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChargingScheduler.name);
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;

  constructor(private readonly charging: ChargingService) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    const refresh = () => {
      if (this.running) return;
      this.running = this.charging.refresh()
        .catch(error => this.logger.error('Charging schedule refresh failed', error))
        .finally(() => { this.running = undefined; });
    };
    refresh();
    this.timer = setInterval(refresh, 10_000);
    this.timer.unref();
  }

  async onModuleDestroy() {
    clearInterval(this.timer);
    await this.running;
  }
}

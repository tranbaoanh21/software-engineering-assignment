import { Module } from '@nestjs/common';
import { SettingsModule } from './config/settings.module.js';
import { HealthController } from './health.controller.js';
import { StateIngestModule } from './integrations/state-ingest/state-ingest.module.js';
import { ChgModule } from './modules/chg/chg.module.js';
import { GenModule } from './modules/gen/gen.module.js';
import { HubModule } from './modules/hub/hub.module.js';
import { OpsModule } from './modules/ops/ops.module.js';
import { ParkModule } from './modules/park/park.module.js';
import { ResModule } from './modules/res/res.module.js';
import { SimModule } from './modules/sim/sim.module.js';
import { TripModule } from './modules/trip/trip.module.js';
import { DatabaseModule } from './shared/database/database.module.js';
import { LiveGateway } from './shared/live/live.gateway.js';

@Module({
  imports: [
    SettingsModule, DatabaseModule, GenModule, HubModule,
    ResModule, TripModule, ParkModule, ChgModule, OpsModule, SimModule,
    StateIngestModule,
  ],
  controllers: [HealthController],
  providers: [LiveGateway],
})
export class AppModule {}

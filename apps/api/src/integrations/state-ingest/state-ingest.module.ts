import { Module } from '@nestjs/common';
import { ChgModule } from '../../modules/chg/chg.module.js';
import { OpsModule } from '../../modules/ops/ops.module.js';
import { ParkModule } from '../../modules/park/park.module.js';
import { TripJourneyModule } from '../../modules/trip/trip-journey.module.js';
import { TripModule } from '../../modules/trip/trip.module.js';
import { StateDataAdapter } from './state-data.adapter.js';
import { StateIngestController } from './state-ingest.controller.js';

@Module({
  imports: [TripModule, TripJourneyModule, ParkModule, ChgModule, OpsModule],
  controllers: [StateIngestController],
  providers: [StateDataAdapter],
})
export class StateIngestModule {}

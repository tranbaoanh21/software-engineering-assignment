import { Body, Controller, Get, Headers, HttpCode, Post } from '@nestjs/common';
import { StateDataAdapter } from './state-data.adapter.js';

@Controller('state-events')
export class StateIngestController {
  constructor(private readonly adapter: StateDataAdapter) {}

  @Get('handoffs')
  listHandoffs(@Headers('x-iot-source-key') key: string | undefined) {
    return this.adapter.listHandoffs(key);
  }

  @Get('active-trip-batteries')
  activeTripBatteries(@Headers('x-iot-source-key') key: string | undefined) {
    return this.adapter.activeTripBatteries(key);
  }

  @Get('parking-verifications')
  listParkingVerifications(@Headers('x-iot-source-key') key: string | undefined) {
    return this.adapter.listParkingVerifications(key);
  }

  @Get('charging-steps')
  listChargingSteps(@Headers('x-iot-source-key') key: string | undefined) {
    return this.adapter.pendingChargingSteps(key);
  }

  @Post()
  @HttpCode(200)
  ingest(@Headers('x-iot-source-key') key: string | undefined, @Body() body: unknown) {
    return this.adapter.ingest(key, body);
  }
}

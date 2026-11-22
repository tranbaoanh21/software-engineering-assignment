import { Controller, Get } from '@nestjs/common';
import { HubService } from '../application/hub.service.js';

@Controller('hubs')
export class HubController {
  constructor(private readonly hubs: HubService) {}

  @Get()
  list() {
    return this.hubs.list();
  }
}

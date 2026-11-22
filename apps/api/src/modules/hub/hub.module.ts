import { NetworkController } from './presentation/network.controller.js';
import { NetworkReader } from './application/network-reader.port.js';
import { PrismaNetworkStore } from './infrastructure/prisma-network.store.js';
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module.js';
import { HubService } from './application/hub.service.js';
import { HubController } from './presentation/hub.controller.js';

import { HubStore } from './application/hub-store.port.js';
import { PrismaHubStore } from './infrastructure/prisma-hub.store.js';

@Module({
  imports: [DatabaseModule],
  controllers: [HubController, NetworkController],
  providers: [{ provide: HubStore, useClass: PrismaHubStore }, HubService, { provide: NetworkReader, useClass: PrismaNetworkStore }],
  exports: [HubService, NetworkReader],
})
export class HubModule {}

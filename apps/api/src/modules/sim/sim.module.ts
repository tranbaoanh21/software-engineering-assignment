import { Module } from '@nestjs/common';
import { AuditModule } from '../../shared/audit/audit.module.js';
import { DatabaseModule } from '../../shared/database/database.module.js';
import { GenModule } from '../gen/gen.module.js';
import { HubModule } from '../hub/hub.module.js';
import { SimulationService } from './application/simulation.service.js';
import { PrismaSimulationStore } from './infrastructure/prisma-simulation.store.js';
import { SimulationController } from './presentation/simulation.controller.js';

@Module({
  imports: [AuditModule, DatabaseModule, GenModule, HubModule],
  controllers: [SimulationController],
  providers: [SimulationService, PrismaSimulationStore],
})
export class SimModule {}

import { Module } from '@nestjs/common';
import { AuditModule } from '../../shared/audit/audit.module.js';
import { DatabaseModule } from '../../shared/database/database.module.js';
import { ChgModule } from '../chg/chg.module.js';
import { GenModule } from '../gen/gen.module.js';
import { HubModule } from '../hub/hub.module.js';
import { TripModule } from '../trip/trip.module.js';
import { OperationsService } from './application/operations.service.js';
import { PrismaOperationsStore } from './infrastructure/prisma-operations.store.js';
import { PrismaResourceOwnerAdapter } from './infrastructure/prisma-resource-owner.adapter.js';
import { OperationsController } from './presentation/operations.controller.js';

@Module({
  imports: [AuditModule, DatabaseModule, GenModule, HubModule, TripModule, ChgModule],
  controllers: [OperationsController],
  providers: [OperationsService, PrismaOperationsStore, PrismaResourceOwnerAdapter],
  exports: [OperationsService],
})
export class OpsModule {}

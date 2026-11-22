import { Module } from '@nestjs/common';
import { AuditModule } from '../../shared/audit/audit.module.js';
import { AdminService } from './application/admin.service.js';
import { PrismaAdminStore } from './infrastructure/prisma-admin.store.js';
import { AdminController } from './presentation/admin.controller.js';
import { DatabaseModule } from '../../shared/database/database.module.js';
import { AccessService } from './application/access.service.js';
import { AccessGuard } from './presentation/access.guard.js';
import { AuthController } from './presentation/auth.controller.js';
import { LoginThrottle } from './presentation/login-throttle.service.js';

import { AccessStore } from './application/access-store.port.js';
import { PrismaAccessStore } from './infrastructure/prisma-access.store.js';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [AuthController, AdminController],
  providers: [{ provide: AccessStore, useClass: PrismaAccessStore }, AccessService, AccessGuard, LoginThrottle, AdminService, PrismaAdminStore],
  exports: [AccessService, AccessGuard],
})
export class GenModule {}

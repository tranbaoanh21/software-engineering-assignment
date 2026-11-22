import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './shared/database/prisma.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch {
      throw new ServiceUnavailableException('Cơ sở dữ liệu chưa sẵn sàng');
    }
  }
}

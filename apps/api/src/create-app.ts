import 'reflect-metadata';
import type { Server } from 'node:http';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { LiveGateway } from './shared/live/live.gateway.js';

export async function createApp() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: process.env.NODE_ENV === 'test' ? false : undefined,
  });
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.get(LiveGateway).attach(app.getHttpServer() as Server);
  return app;
}

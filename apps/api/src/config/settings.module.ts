import { Global, Module } from '@nestjs/common';
import { getSettings, SETTINGS } from './settings.js';

@Global()
@Module({
  providers: [{ provide: SETTINGS, useFactory: getSettings }],
  exports: [SETTINGS],
})
export class SettingsModule {}

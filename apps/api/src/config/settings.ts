function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error('Missing environment variable: ' + name);
  return value;
}

export function getSettings() {
  const origin = new URL(required('APP_ORIGIN')).origin;
  const port = Number(process.env.API_PORT ?? 3000);

  if (process.env.NODE_ENV === 'production' && !origin.startsWith('https://')) {
    throw new Error('Production APP_ORIGIN must use HTTPS');
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('API_PORT is invalid');
  }

  return {
    databaseUrl: required('DATABASE_URL'),
    origin,
    secureCookie: origin.startsWith('https://'),
    port,
    demoBatteryEnabled: process.env.IOT_DEMO_BATTERY === 'true',
    iotSourceId: required('IOT_SOURCE_ID'),
    iotSourceKey: required('IOT_SOURCE_KEY'),
  };
}

export const SETTINGS = Symbol('Settings');
export type Settings = ReturnType<typeof getSettings>;

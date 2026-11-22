import { hash } from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Role } from '../../generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;
const sourceId = process.env.IOT_SOURCE_ID;
if (!connectionString || !sourceId) throw new Error('DATABASE_URL and IOT_SOURCE_ID are required');

const accounts = [
  { username: 'student', displayName: 'Sinh viên demo', role: 'STU' },
  { username: 'operator', displayName: 'Nhân viên vận hành', role: 'OPR' },
  { username: 'maintenance', displayName: 'Nhân viên kỹ thuật', role: 'MNT' },
  { username: 'admin', displayName: 'Quản trị viên', role: 'ADM' },
] satisfies { username: string; displayName: string; role: Role }[];

const hubs = [
  { code: 'METRO', name: 'Ga Metro Đại học Quốc gia', latitude: 10.86634, longitude: 106.80126 },
  { code: 'KTX-A', name: 'Ký túc xá Khu A', latitude: 10.8795, longitude: 106.8042 },
  { code: 'KTX-B', name: 'Ký túc xá Khu B', latitude: 10.88214, longitude: 106.78256 },
  { code: 'HCMUT', name: 'Đại học Bách Khoa · Cơ sở Dĩ An', latitude: 10.8807, longitude: 106.8050 },
  { code: 'USSH', name: 'Đại học Khoa học Xã hội và Nhân văn', latitude: 10.872048, longitude: 106.801756 },
  { code: 'USH', name: 'Đại học Thể dục Thể thao TP.HCM', latitude: 10.8705883, longitude: 106.7954077 },
];

const demoPasswordMinimum = process.env.NODE_ENV === 'production' ? 12 : 8;
const credentials = accounts.map(account => {
  const envName = 'DEMO_' + account.role + '_PASSWORD';
  const password = process.env[envName];
  if (!password || password.length < demoPasswordMinimum) {
    throw new Error(envName + ' must contain at least ' + demoPasswordMinimum + ' characters');
  }
  return { ...account, password };
});

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
try {
  const accountData = await Promise.all(credentials.map(async account => ({
    username: account.username,
    displayName: account.displayName,
    passwordHash: await hash(account.password),
    assignments: { create: { role: account.role, allHubs: account.role === 'OPR' } },
  })));
  await prisma.$transaction(async tx => {
    for (const data of accountData) {
      const account = await tx.account.upsert({ where: { username: data.username }, create: data, update: {} });
      if (account.username === 'student') {
        await tx.privateVehicle.upsert({
          where: { plate: '59-X1 123.45' },
          create: { ownerId: account.id, plate: '59-X1 123.45', batteryPercent: 36, lastObservedAt: new Date() }, update: {},
        });
        await tx.privateVehicle.updateMany({
          where: { ownerId: account.id, plate: '59-X1 123.45', lastObservedAt: null },
          data: { batteryPercent: 36, lastObservedAt: new Date() },
        });
      }
    }

    for (const hub of hubs) {
      const stored = await tx.mobilityHub.upsert({
        where: { code: hub.code },
        create: { ...hub, serviceStatus: 'ACTIVE', lastObservedAt: new Date() },
        update: {},
      });
      const olderMarker = hub.code === 'METRO' ? { latitude: 10.8784, longitude: 106.8053 }
        : hub.code === 'KTX-B' ? { latitude: 10.8938, longitude: 106.7810 }
        : undefined;
      if (olderMarker) {
        await tx.mobilityHub.updateMany({
          where: { id: stored.id, ...olderMarker }, data: { latitude: hub.latitude, longitude: hub.longitude },
        });
      }
      await tx.sharedVehicle.upsert({
        where: { code: hub.code + '-01' },
        create: {
          id: hub.code === 'KTX-B' ? '86e274aa-6305-4f51-92d5-b4b8eaf03e01' : undefined,
          code: hub.code + '-01',
          hubId: stored.id,
          serviceStatus: 'ACTIVE',
          batteryPercent: 60,
          lastObservedAt: new Date(),
          status: 'AVAILABLE',
          sourceId,
        },
        update: {},
      });
      await tx.sharedVehicle.updateMany({
        where: { code: hub.code + '-01', hubId: stored.id, lastObservedAt: null, status: 'AVAILABLE' },
        data: { lastObservedAt: new Date() },
      });
      if (['KTX-B', 'HCMUT', 'USSH'].includes(hub.code)) {
        const code = hub.code + '-02';
        await tx.sharedVehicle.upsert({
          where: { code },
          create: { code, hubId: stored.id, sourceId, batteryPercent: 82,
            status: 'AVAILABLE', serviceStatus: 'ACTIVE', lastObservedAt: new Date() },
          update: {},
        });
      }
      for (let number = 1; number <= 2; number++) {
        const code = hub.code + '-C' + number;
        await tx.chargingPoint.upsert({
          where: { code },
          create: { code, hubId: stored.id, sourceId, connector: 'AC', powerKw: 0.5,
            status: 'AVAILABLE', serviceStatus: 'ACTIVE', lastObservedAt: new Date() },
          update: {},
        });
      }
      for (let number = 1; number <= 4; number++) {
        const code = hub.code + '-P' + String(number).padStart(2, '0');
        await tx.parkingSpace.upsert({
          where: { code },
          create: {
            code, hubId: stored.id, serviceStatus: 'ACTIVE', status: 'AVAILABLE',
            sourceId, occupied: false, lastObservedAt: new Date(),
          },
          update: {},
        });
      }
    }
  });
  console.log('Seeded demo accounts, hubs, vehicles and parking spaces.');
} finally {
  await prisma.$disconnect();
}

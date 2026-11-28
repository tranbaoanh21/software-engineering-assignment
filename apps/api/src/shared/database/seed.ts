import { hash } from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Role } from '../../generated/prisma/client.js';
import { readHubArrivalCapacity } from '../../modules/hub/infrastructure/prisma-hub.store.js';
import { returnedVehicleStatus } from '../../modules/trip/domain/trip.policy.js';

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
  {
    code: 'METRO', name: 'Ga Metro Đại học Quốc gia', latitude: 10.86634, longitude: 106.80126,
    vehicleCount: 6, parkingCount: 12,
  },
  {
    code: 'KTX-A', name: 'Ký túc xá Khu A', latitude: 10.8795, longitude: 106.8042,
    vehicleCount: 6, parkingCount: 10,
  },
  {
    code: 'KTX-B', name: 'Ký túc xá Khu B', latitude: 10.88214, longitude: 106.78256,
    vehicleCount: 6, parkingCount: 12,
  },
  {
    code: 'HCMUT', name: 'Đại học Bách Khoa · Cơ sở Dĩ An', latitude: 10.8807, longitude: 106.8050,
    vehicleCount: 5, parkingCount: 10,
  },
  {
    code: 'USSH', name: 'Đại học Khoa học Xã hội và Nhân văn', latitude: 10.872048, longitude: 106.801756,
    vehicleCount: 4, parkingCount: 8,
  },
  {
    code: 'USH', name: 'Đại học Thể dục Thể thao TP.HCM', latitude: 10.8705883, longitude: 106.7954077,
    vehicleCount: 3, parkingCount: 6,
  },
  {
    code: 'UIT', name: 'Đại học Công nghệ Thông tin', latitude: 10.869971, longitude: 106.803217,
    vehicleCount: 4, parkingCount: 8,
  },
  {
    code: 'HCMUS', name: 'Đại học Khoa học Tự nhiên · Cơ sở khu ĐHQG', latitude: 10.875927, longitude: 106.797776,
    vehicleCount: 4, parkingCount: 8,
  },
  {
    code: 'HCMIU', name: 'Đại học Quốc tế', latitude: 10.877758, longitude: 106.801215,
    vehicleCount: 4, parkingCount: 8,
  },
  {
    code: 'VNU-LIB', name: 'Thư viện Trung tâm ĐHQG-HCM', latitude: 10.869758, longitude: 106.796204,
    vehicleCount: 3, parkingCount: 6,
  },
];
const initialVehicleBatteries = [60, 82, 74, 47, 55, 24];
const demoTelemetryVehicleId = '86e274aa-6305-4f51-92d5-b4b8eaf03e01';

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
  const observedAt = new Date();
  await prisma.$transaction(async tx => {
    for (const data of accountData) {
      const account = await tx.account.upsert({ where: { username: data.username }, create: data, update: {} });
      if (account.username === 'student') {
        const plate = '59-X1 123.45';
        const demoVehicle = await tx.privateVehicle.findFirst({ where: { plate }, select: { id: true } });
        if (!demoVehicle) {
          await tx.privateVehicle.create({
            data: { ownerId: account.id, plate, batteryPercent: 36, lastObservedAt: observedAt },
          });
        }
        await tx.privateVehicle.updateMany({
          where: { ownerId: account.id, plate, lastObservedAt: null, removedAt: null },
          data: { batteryPercent: 36, lastObservedAt: observedAt },
        });
      }
    }

    for (const { vehicleCount, parkingCount, ...hub } of hubs) {
      const stored = await tx.mobilityHub.upsert({
        where: { code: hub.code },
        create: { ...hub, serviceStatus: 'ACTIVE', lastObservedAt: observedAt },
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
      await tx.sharedVehicle.updateMany({
        where: { code: hub.code + '-01', hubId: stored.id, lastObservedAt: null, status: 'AVAILABLE' },
        data: { lastObservedAt: observedAt },
      });
      const capacity = await readHubArrivalCapacity(tx, stored.id);
      if (!capacity?.active) continue;

      const resource = { hubId: stored.id, sourceId, serviceStatus: 'ACTIVE' as const, lastObservedAt: observedAt };
      if (capacity.spaces > 0) {
        const vehicles = initialVehicleBatteries.slice(0, vehicleCount).map((batteryPercent, index) => ({
          ...resource,
          id: hub.code === 'KTX-B' && index === 0 ? demoTelemetryVehicleId : undefined,
          code: hub.code + '-' + String(index + 1).padStart(2, '0'),
          batteryPercent,
          status: returnedVehicleStatus(batteryPercent, false),
        }));
        const existing = await tx.sharedVehicle.findMany({
          where: { code: { in: vehicles.map(vehicle => vehicle.code) } },
          select: { code: true },
        });
        const existingCodes = new Set(existing.map(vehicle => vehicle.code));
        await tx.sharedVehicle.createMany({
          data: vehicles.filter(vehicle => !existingCodes.has(vehicle.code)).slice(0, capacity.spaces),
          skipDuplicates: true,
        });
      }
      await tx.chargingPoint.createMany({
        data: Array.from({ length: 2 }, (_, index) => ({
          ...resource, code: hub.code + '-C' + (index + 1), connector: 'AC', powerKw: 0.5, status: 'AVAILABLE',
        })),
        skipDuplicates: true,
      });
      await tx.parkingSpace.createMany({
        data: Array.from({ length: parkingCount }, (_, index) => ({
          ...resource, code: hub.code + '-P' + String(index + 1).padStart(2, '0'), status: 'AVAILABLE', occupied: false,
        })),
        skipDuplicates: true,
      });
    }
  }, { isolationLevel: 'Serializable', timeout: 30_000 });
  console.log('Seeded demo accounts, hubs, vehicles, parking spaces and charging points.');
} finally {
  await prisma.$disconnect();
}

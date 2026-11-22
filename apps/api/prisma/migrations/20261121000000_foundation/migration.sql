-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STU', 'OPR', 'MNT', 'ADM');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'LOCKED');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'IN_USE', 'CHARGING', 'OUT_OF_SERVICE', 'AWAITING_CHARGE');

-- CreateTable
CREATE TABLE "Account" (
    "id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessAssignment" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "role" "Role" NOT NULL,

    CONSTRAINT "AccessAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "accountId" UUID NOT NULL,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MobilityHub" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "serviceStatus" "ServiceStatus" NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "MobilityHub_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedVehicle" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "hubId" UUID,
    "batteryPercent" INTEGER NOT NULL,
    "serviceStatus" "ServiceStatus" NOT NULL DEFAULT 'DRAFT',
    "status" "VehicleStatus" NOT NULL DEFAULT 'OUT_OF_SERVICE',
    "sourceId" TEXT NOT NULL,
    "telemetrySequence" INTEGER NOT NULL DEFAULT 0,
    "lastObservedAt" TIMESTAMP(3),

    CONSTRAINT "SharedVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StateEventRecord" (
    "sourceId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StateEventRecord_pkey" PRIMARY KEY ("sourceId","eventId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_username_key" ON "Account"("username");

-- CreateIndex
CREATE UNIQUE INDEX "AccessAssignment_accountId_role_key" ON "AccessAssignment"("accountId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_accountId_revokedAt_idx" ON "Session"("accountId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MobilityHub_code_key" ON "MobilityHub"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SharedVehicle_code_key" ON "SharedVehicle"("code");

-- CreateIndex
CREATE INDEX "SharedVehicle_hubId_idx" ON "SharedVehicle"("hubId");

-- AddForeignKey
ALTER TABLE "AccessAssignment" ADD CONSTRAINT "AccessAssignment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedVehicle" ADD CONSTRAINT "SharedVehicle_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "MobilityHub"("id") ON DELETE SET NULL ON UPDATE CASCADE;


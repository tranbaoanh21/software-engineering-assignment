BEGIN;

-- CreateEnum
CREATE TYPE "ResourceKind" AS ENUM ('HUB', 'VEHICLE', 'PARKING_SPACE', 'CHARGING_POINT');

-- CreateEnum
CREATE TYPE "ChargingPointStatus" AS ENUM ('AVAILABLE', 'CHARGING', 'OCCUPIED', 'OUT_OF_SERVICE');

-- CreateEnum
CREATE TYPE "ChargingRequestStatus" AS ENUM ('PENDING', 'SCHEDULED', 'CHARGING', 'COMPLETED', 'INTERRUPTED');

-- CreateEnum
CREATE TYPE "ChargingSessionStatus" AS ENUM ('READY', 'CHARGING', 'COMPLETED', 'INTERRUPTED');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('PLANNED', 'DEPARTED', 'ARRIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SimulationStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "AccessAssignment" ADD COLUMN     "allHubs" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hubIds" UUID[] DEFAULT ARRAY[]::UUID[];

-- AlterTable
ALTER TABLE "MobilityHub" ADD COLUMN     "chargeKw" DOUBLE PRECISION NOT NULL DEFAULT 2,
ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "fault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastObservedAt" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SharedVehicle" ADD COLUMN     "batteryKwh" DOUBLE PRECISION DEFAULT 0.72,
ADD COLUMN     "connector" TEXT DEFAULT 'AC',
ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "fault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxChargeKw" DOUBLE PRECISION DEFAULT 0.5,
ADD COLUMN     "sinceMaintenanceKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "transferPlanId" UUID,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PrivateVehicle" ADD COLUMN     "batteryKwh" DOUBLE PRECISION DEFAULT 0.8,
ADD COLUMN     "batteryPercent" INTEGER,
ADD COLUMN     "connector" TEXT DEFAULT 'AC',
ADD COLUMN     "lastObservedAt" TIMESTAMP(3),
ADD COLUMN     "maxChargeKw" DOUBLE PRECISION DEFAULT 0.5;

-- AlterTable
ALTER TABLE "ParkingSpace" ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ChargingPoint" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "hubId" UUID NOT NULL,
    "sourceId" TEXT NOT NULL,
    "connector" TEXT NOT NULL,
    "powerKw" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 0,
    "serviceStatus" "ServiceStatus" NOT NULL DEFAULT 'DRAFT',
    "status" "ChargingPointStatus" NOT NULL DEFAULT 'OUT_OF_SERVICE',
    "fault" BOOLEAN NOT NULL DEFAULT false,
    "lastObservedAt" TIMESTAMP(3),

    CONSTRAINT "ChargingPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChargingRequest" (
    "id" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "vehicleKind" TEXT NOT NULL,
    "vehicleId" UUID NOT NULL,
    "vehicleCode" TEXT NOT NULL,
    "hubId" UUID NOT NULL,
    "status" "ChargingRequestStatus" NOT NULL DEFAULT 'PENDING',
    "desiredBy" TIMESTAMP(3),
    "neededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "overrideRank" INTEGER,
    "preferredPointId" UUID,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ChargingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChargingSession" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "pointId" UUID NOT NULL,
    "status" "ChargingSessionStatus" NOT NULL DEFAULT 'READY',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "powerKw" DOUBLE PRECISION NOT NULL,
    "batteryPercent" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "lastObservedAt" TIMESTAMP(3),

    CONSTRAINT "ChargingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" UUID NOT NULL,
    "resourceKind" "ResourceKind" NOT NULL,
    "resourceId" UUID NOT NULL,
    "hubId" UUID,
    "tripId" UUID,
    "reporterId" UUID,
    "assigneeId" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "dueAt" TIMESTAMP(3),
    "handover" JSONB,
    "safe" BOOLEAN,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RedistributionPlan" (
    "id" UUID NOT NULL,
    "sourceHubId" UUID NOT NULL,
    "targetHubId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "recommendationId" UUID,
    "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RedistributionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferItem" (
    "planId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'PLANNED',
    "departedAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),

    CONSTRAINT "TransferItem_pkey" PRIMARY KEY ("planId","vehicleId")
);

-- CreateTable
CREATE TABLE "SimulationScenario" (
    "id" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "hubIds" UUID[],
    "parameters" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SimulationScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulationRun" (
    "id" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "scenarioId" UUID NOT NULL,
    "scenarioVersion" INTEGER NOT NULL,
    "hubIds" UUID[],
    "inputs" JSONB NOT NULL,
    "snapshot" JSONB NOT NULL,
    "baseTime" TIMESTAMP(3) NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceRunId" UUID,
    "modelVersion" TEXT NOT NULL,
    "status" "SimulationStatus" NOT NULL DEFAULT 'RUNNING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "analysisReady" BOOLEAN NOT NULL DEFAULT false,
    "results" JSONB,
    "error" TEXT,

    CONSTRAINT "SimulationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeReceipt" (
    "actorId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeReceipt_pkey" PRIMARY KEY ("actorId","requestId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChargingPoint_code_key" ON "ChargingPoint"("code");

-- CreateIndex
CREATE INDEX "ChargingPoint_hubId_serviceStatus_status_idx" ON "ChargingPoint"("hubId", "serviceStatus", "status");

-- CreateIndex
CREATE INDEX "ChargingRequest_hubId_status_idx" ON "ChargingRequest"("hubId", "status");

-- CreateIndex
CREATE INDEX "ChargingRequest_vehicleId_status_idx" ON "ChargingRequest"("vehicleId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ChargingRequest_authorId_requestId_key" ON "ChargingRequest"("authorId", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "ChargingSession_requestId_key" ON "ChargingSession"("requestId");

-- CreateIndex
CREATE INDEX "ChargingSession_pointId_status_idx" ON "ChargingSession"("pointId", "status");

-- CreateIndex
CREATE INDEX "Incident_hubId_status_idx" ON "Incident"("hubId", "status");

-- CreateIndex
CREATE INDEX "Incident_assigneeId_status_idx" ON "Incident"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "RedistributionPlan_sourceHubId_targetHubId_status_idx" ON "RedistributionPlan"("sourceHubId", "targetHubId", "status");

-- CreateIndex
CREATE INDEX "SimulationRun_status_idx" ON "SimulationRun"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SimulationRun_authorId_requestId_key" ON "SimulationRun"("authorId", "requestId");

-- AddForeignKey
ALTER TABLE "ChargingPoint" ADD CONSTRAINT "ChargingPoint_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "MobilityHub"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargingSession" ADD CONSTRAINT "ChargingSession_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ChargingRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargingSession" ADD CONSTRAINT "ChargingSession_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "ChargingPoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferItem" ADD CONSTRAINT "TransferItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "RedistributionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationRun" ADD CONSTRAINT "SimulationRun_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "SimulationScenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


UPDATE "AccessAssignment" SET "allHubs" = true WHERE "role" = 'OPR';

CREATE UNIQUE INDEX "ChargingRequest_one_queue_per_vehicle" ON "ChargingRequest" ("vehicleId")
  WHERE "status" IN ('PENDING', 'SCHEDULED', 'CHARGING');
CREATE UNIQUE INDEX "ChargingSession_one_physical_binding" ON "ChargingSession" ("pointId")
  WHERE "startedAt" IS NOT NULL AND "releasedAt" IS NULL;
CREATE UNIQUE INDEX "Incident_one_open_per_resource" ON "Incident" ("resourceKind", "resourceId")
  WHERE "status" <> 'CLOSED';
ALTER TABLE "ChargingSession" ADD CONSTRAINT "ChargingSession_valid_window" CHECK ("endAt" > "startAt" AND "powerKw" > 0);
COMMIT;

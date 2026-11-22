-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'INTERRUPTED');

-- CreateEnum
CREATE TYPE "TripHandoffKind" AS ENUM ('PICKUP', 'RETURN');

-- CreateEnum
CREATE TYPE "TripHandoffStatus" AS ENUM ('PENDING', 'APPLIED', 'REJECTED');

-- AlterTable
ALTER TABLE "MobilityHub" ADD COLUMN     "vehicleCapacity" INTEGER NOT NULL DEFAULT 8;

-- CreateTable
CREATE TABLE "Trip" (
    "id" UUID NOT NULL,
    "reservationId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "status" "TripStatus" NOT NULL,
    "startHubId" UUID NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "startBattery" INTEGER NOT NULL,
    "startVehicleStatus" "VehicleStatus" NOT NULL,
    "endHubId" UUID,
    "endedAt" TIMESTAMP(3),
    "endBattery" INTEGER,
    "endVehicleStatus" "VehicleStatus",
    "durationSeconds" INTEGER,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripHandoffCommand" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "kind" "TripHandoffKind" NOT NULL,
    "status" "TripHandoffStatus" NOT NULL DEFAULT 'PENDING',
    "studentId" UUID NOT NULL,
    "subjectId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "hubId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "tripId" UUID,

    CONSTRAINT "TripHandoffCommand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Trip_reservationId_key" ON "Trip"("reservationId");

-- CreateIndex
CREATE INDEX "Trip_studentId_status_startedAt_idx" ON "Trip"("studentId", "status", "startedAt");

-- CreateIndex
CREATE INDEX "TripHandoffCommand_studentId_kind_subjectId_status_idx" ON "TripHandoffCommand"("studentId", "kind", "subjectId", "status");

-- CreateIndex
CREATE INDEX "TripHandoffCommand_status_expiresAt_idx" ON "TripHandoffCommand"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "TripHandoffCommand_studentId_requestId_key" ON "TripHandoffCommand"("studentId", "requestId");

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "VehicleReservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "SharedVehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_startHubId_fkey" FOREIGN KEY ("startHubId") REFERENCES "MobilityHub"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_endHubId_fkey" FOREIGN KEY ("endHubId") REFERENCES "MobilityHub"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripHandoffCommand" ADD CONSTRAINT "TripHandoffCommand_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripHandoffCommand" ADD CONSTRAINT "TripHandoffCommand_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "SharedVehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripHandoffCommand" ADD CONSTRAINT "TripHandoffCommand_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "MobilityHub"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripHandoffCommand" ADD CONSTRAINT "TripHandoffCommand_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;


CREATE UNIQUE INDEX "Trip_one_open_per_vehicle" ON "Trip" ("vehicleId") WHERE "status" = 'IN_PROGRESS';
ALTER TABLE "MobilityHub" ADD CONSTRAINT "MobilityHub_nonnegative_capacity" CHECK ("vehicleCapacity" >= 0);

-- CreateEnum
CREATE TYPE "VehicleReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FULFILLED', 'CANCELLED', 'EXPIRED', 'REJECTED');

-- AlterTable
ALTER TABLE "SharedVehicle" ADD COLUMN     "reservationHoldId" UUID;

-- CreateTable
CREATE TABLE "VehicleReservation" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "hubId" UUID NOT NULL,
    "status" "VehicleReservationStatus" NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "VehicleReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEntry" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" UUID NOT NULL,
    "requestId" UUID,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "details" JSONB NOT NULL,

    CONSTRAINT "AuditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehicleReservation_status_expiresAt_idx" ON "VehicleReservation"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "VehicleReservation_vehicleId_status_idx" ON "VehicleReservation"("vehicleId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleReservation_studentId_requestId_key" ON "VehicleReservation"("studentId", "requestId");

-- CreateIndex
CREATE INDEX "AuditEntry_targetType_targetId_occurredAt_idx" ON "AuditEntry"("targetType", "targetId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "SharedVehicle_reservationHoldId_key" ON "SharedVehicle"("reservationHoldId");

-- AddForeignKey
ALTER TABLE "SharedVehicle" ADD CONSTRAINT "SharedVehicle_reservationHoldId_fkey" FOREIGN KEY ("reservationHoldId") REFERENCES "VehicleReservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleReservation" ADD CONSTRAINT "VehicleReservation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleReservation" ADD CONSTRAINT "VehicleReservation_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "SharedVehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleReservation" ADD CONSTRAINT "VehicleReservation_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "MobilityHub"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Each active hold occupies a slot for its student and its vehicle.
CREATE UNIQUE INDEX "VehicleReservation_one_active_per_student" ON "VehicleReservation" ("studentId")
  WHERE "status" IN ('PENDING', 'CONFIRMED');
CREATE UNIQUE INDEX "VehicleReservation_one_active_per_vehicle" ON "VehicleReservation" ("vehicleId")
  WHERE "status" IN ('PENDING', 'CONFIRMED');

BEGIN;

CREATE TYPE "ParkingSpaceStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'OCCUPIED', 'OUT_OF_SERVICE');
CREATE TYPE "ParkingReservationStatus" AS ENUM ('CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "ParkingVerificationKind" AS ENUM ('CHECK_IN', 'CHECK_OUT');
CREATE TYPE "ParkingVerificationStatus" AS ENUM ('PENDING', 'APPLIED', 'REJECTED');

CREATE TABLE "PrivateVehicle" (
    "id" UUID PRIMARY KEY,
    "plate" TEXT NOT NULL,
    "ownerId" UUID NOT NULL,
    CONSTRAINT "PrivateVehicle_ownerId_fkey" FOREIGN KEY ("ownerId")
        REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ParkingSpace" (
    "id" UUID PRIMARY KEY,
    "code" TEXT NOT NULL,
    "hubId" UUID NOT NULL,
    "serviceStatus" "ServiceStatus" NOT NULL DEFAULT 'DRAFT',
    "status" "ParkingSpaceStatus" NOT NULL DEFAULT 'OUT_OF_SERVICE',
    "sourceId" TEXT NOT NULL,
    "occupied" BOOLEAN,
    "fault" BOOLEAN NOT NULL DEFAULT false,
    "lastObservedAt" TIMESTAMP(3),
    CONSTRAINT "ParkingSpace_hubId_fkey" FOREIGN KEY ("hubId")
        REFERENCES "MobilityHub" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ParkingReservation" (
    "id" UUID PRIMARY KEY,
    "requestId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "privateVehicleId" UUID NOT NULL,
    "spaceId" UUID NOT NULL,
    "status" "ParkingReservationStatus" NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "checkInAt" TIMESTAMP(3),
    "checkOutAt" TIMESTAMP(3),
    CONSTRAINT "ParkingReservation_studentId_fkey" FOREIGN KEY ("studentId")
        REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ParkingReservation_privateVehicleId_fkey" FOREIGN KEY ("privateVehicleId")
        REFERENCES "PrivateVehicle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ParkingReservation_spaceId_fkey" FOREIGN KEY ("spaceId")
        REFERENCES "ParkingSpace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ParkingVerification" (
    "id" UUID PRIMARY KEY,
    "requestId" UUID NOT NULL,
    "reservationId" UUID NOT NULL,
    "kind" "ParkingVerificationKind" NOT NULL,
    "status" "ParkingVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    CONSTRAINT "ParkingVerification_reservationId_fkey" FOREIGN KEY ("reservationId")
        REFERENCES "ParkingReservation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PrivateVehicle_plate_key" ON "PrivateVehicle" ("plate");
CREATE INDEX "PrivateVehicle_ownerId_idx" ON "PrivateVehicle" ("ownerId");
CREATE UNIQUE INDEX "ParkingSpace_code_key" ON "ParkingSpace" ("code");
CREATE INDEX "ParkingSpace_hubId_serviceStatus_status_idx" ON "ParkingSpace" ("hubId", "serviceStatus", "status");
CREATE UNIQUE INDEX "ParkingReservation_studentId_requestId_key" ON "ParkingReservation" ("studentId", "requestId");
CREATE INDEX "ParkingReservation_studentId_confirmedAt_idx" ON "ParkingReservation" ("studentId", "confirmedAt");
CREATE INDEX "ParkingReservation_status_expiresAt_idx" ON "ParkingReservation" ("status", "expiresAt");
CREATE UNIQUE INDEX "ParkingVerification_reservationId_requestId_key" ON "ParkingVerification" ("reservationId", "requestId");
CREATE INDEX "ParkingVerification_reservationId_createdAt_idx" ON "ParkingVerification" ("reservationId", "createdAt");
CREATE INDEX "ParkingVerification_status_expiresAt_idx" ON "ParkingVerification" ("status", "expiresAt");

CREATE UNIQUE INDEX "ParkingReservation_one_active_per_space"
ON "ParkingReservation" ("spaceId") WHERE "status" IN ('CONFIRMED', 'CHECKED_IN');

CREATE UNIQUE INDEX "ParkingReservation_one_active_per_private_vehicle"
ON "ParkingReservation" ("privateVehicleId") WHERE "status" IN ('CONFIRMED', 'CHECKED_IN');

COMMIT;

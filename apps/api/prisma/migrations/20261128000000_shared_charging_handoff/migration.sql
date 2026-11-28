ALTER TYPE "VehicleStatus" ADD VALUE 'AWAITING_CHARGE_APPROVAL';
ALTER TYPE "ChargingRequestStatus" ADD VALUE 'AWAITING_APPROVAL';

ALTER TABLE "ChargingRequest"
  ALTER COLUMN "authorId" DROP NOT NULL,
  ADD COLUMN "requiresFleetHandoff" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ChargingSession" ADD COLUMN "plugConfirmedAt" TIMESTAMP(3);

UPDATE "ChargingRequest" AS request
SET "requiresFleetHandoff" = true
FROM "SharedVehicle" AS vehicle
WHERE request."vehicleKind" = 'SHARED'
  AND request."vehicleId" = vehicle.id
  AND request.status IN ('PENDING', 'SCHEDULED')
  AND vehicle."batteryPercent" < 30;

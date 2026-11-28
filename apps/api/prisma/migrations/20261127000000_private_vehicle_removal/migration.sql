ALTER TABLE "PrivateVehicle" ADD COLUMN "removedAt" TIMESTAMP(3);

DROP INDEX "PrivateVehicle_plate_key";
CREATE UNIQUE INDEX "PrivateVehicle_active_plate_key"
    ON "PrivateVehicle" ("plate") WHERE "removedAt" IS NULL;

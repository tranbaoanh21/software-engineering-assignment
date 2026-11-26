ALTER TYPE "IncidentStatus" ADD VALUE 'AWAITING_APPROVAL';

ALTER TABLE "Incident"
  ADD COLUMN "reportedLocation" TEXT,
  ADD COLUMN "confirmedLocation" TEXT;

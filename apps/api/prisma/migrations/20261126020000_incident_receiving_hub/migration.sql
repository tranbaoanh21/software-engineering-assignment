ALTER TABLE "Incident" ADD COLUMN "receivingHubId" UUID;

CREATE INDEX "Incident_receivingHubId_status_idx" ON "Incident"("receivingHubId", "status");

ALTER TABLE "Incident" ADD CONSTRAINT "Incident_receivingHubId_fkey"
  FOREIGN KEY ("receivingHubId") REFERENCES "MobilityHub"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

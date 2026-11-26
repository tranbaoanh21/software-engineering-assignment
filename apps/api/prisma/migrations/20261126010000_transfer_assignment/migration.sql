ALTER TYPE "PlanStatus" ADD VALUE 'AWAITING_APPROVAL';

ALTER TABLE "RedistributionPlan"
  ADD COLUMN "assigneeId" UUID,
  ADD CONSTRAINT "RedistributionPlan_assigneeId_fkey"
    FOREIGN KEY ("assigneeId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "RedistributionPlan_assigneeId_status_idx" ON "RedistributionPlan" ("assigneeId", "status");

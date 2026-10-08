-- Phase 7/8 (2026-09-13): problem/issue flagging + updatedAt, needed for
-- the 2-hour auto-delivery cron's query and safety checks.
ALTER TABLE "orders" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now();
ALTER TABLE "orders" ADD COLUMN "has_issue" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "orders" ADD COLUMN "issue_reason" TEXT;
ALTER TABLE "orders" ADD COLUMN "issue_reported_at" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN "issue_reported_by" TEXT;

CREATE INDEX "orders_orderStatus_hasIssue_updatedAt_idx" ON "orders"("order_status", "has_issue", "updated_at");

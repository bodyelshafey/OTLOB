-- Reintroduces mandatory email + phone verification (removed in
-- 20260831010000_remove_account_verification, reinstated per updated
-- product requirements 2026-09-12). VerificationCode/otp infrastructure
-- was never removed, so only the User columns + supporting indexes are
-- needed here.
--
-- FIX (2026-09-27): the migration that was supposed to have dropped these
-- columns (20260831010000_remove_account_verification) is missing from
-- this repo's migration history, and "phone_verified" was in fact never
-- dropped — it's already added by 20260826120000_auth_google_phone_
-- password_reset earlier in this same chain. Replaying migrations on a
-- fresh database therefore failed here with "column \"phone_verified\" of
-- relation \"users\" already exists", which also blocked every migration
-- after this one (including the very next one, which grandfathers
-- existing users as verified) from ever applying. Made idempotent below
-- so `prisma migrate deploy` can proceed regardless of which columns/
-- indexes already exist in a given database — matching the IF [NOT]
-- EXISTS style already used elsewhere in this migrations folder (see
-- 20260810090000_email_verification_otp, 20260813070000_audit_log_metadata).

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone_verified" BOOLEAN NOT NULL DEFAULT false;

-- Accounts created via Google Sign-In are trusted as email-verified
-- (Google already verified the address) even though the column is new.
UPDATE "users" SET "email_verified" = true WHERE "google_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users"("role");
CREATE INDEX IF NOT EXISTS "users_isActive_idx" ON "users"("is_active");
CREATE INDEX IF NOT EXISTS "verification_codes_userId_purpose_consumedAt_idx" ON "verification_codes"("user_id", "purpose", "consumed_at");
CREATE INDEX IF NOT EXISTS "drivers_status_idx" ON "drivers"("status");

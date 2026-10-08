-- The mandatory-verification gate (see auth.service.ts login()) would
-- otherwise permanently lock out every account that existed before this
-- rebuild -- including admin@otlob.app, which has no phone on file at
-- all and could never receive a phone OTP. Retroactively enforcing a rule
-- that didn't exist at signup time isn't reasonable, so pre-existing
-- accounts are grandfathered in as fully verified. Only NEW registrations
-- from this point on go through the mandatory OTP flow. On a fresh
-- database this matches zero rows and is a safe no-op.
UPDATE "users" SET "email_verified" = true, "phone_verified" = true
WHERE "created_at" < now();

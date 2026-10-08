-- Auth rebuild: phone verification + Google OAuth + password reset support.
-- password_hash becomes nullable because Google-only accounts have no local
-- password. phone_verified tracks whether the phone OTP was actually
-- confirmed (phone itself was already collectible, just never verified).
-- google_id is the linkage key for "Sign in with Google".
-- No changes needed to verification_codes: `purpose` was already a free-form
-- string, so PHONE_VERIFICATION / PASSWORD_RESET reuse it as-is.

ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;

ALTER TABLE "users" ADD COLUMN "phone_verified" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "users" ADD COLUMN "google_id" TEXT;

CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

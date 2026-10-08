-- Phone becomes the primary registration/login identity; email becomes a
-- fully optional field added later (see RegisterDto/LoginDto/AuthService,
-- 2026-09-13). `phone` was already nullable at the DB level and stays that
-- way (see the schema.prisma comment for why) -- required is enforced at
-- the application layer, not here, since two pre-existing accounts have no
-- phone and can't reasonably be backfilled with one.
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;

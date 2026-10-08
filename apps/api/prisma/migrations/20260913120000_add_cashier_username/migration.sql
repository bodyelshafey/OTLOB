-- Cashier-only login identity (Phase 6, 2026-09-13) — see the
-- schema.prisma comment on User.username.
ALTER TABLE "users" ADD COLUMN "username" TEXT;
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- Deleting an address that an order references currently fails: the live
-- constraint orders_address_id_fkey is NO ACTION (the init migration declared
-- the FK with no ON DELETE rule), while prisma/schema.prisma models
-- Order.address as optional (Prisma's default for that is SetNull). Align the
-- database with the schema. Non-destructive: only changes what happens to
-- orders.address_id when an address row is deleted; the order keeps its own
-- copy of the address in orders.full_address. No data is modified.
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_address_id_fkey";
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_address_id_fkey"
  FOREIGN KEY ("address_id") REFERENCES "addresses"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Extends audit_logs with a structured metadata field (change summary)
-- and the actor's IP address, so admin actions are actually reviewable —
-- action/table/record alone don't say what changed or where the request
-- came from.

alter table public.audit_logs
  add column if not exists metadata jsonb,
  add column if not exists ip_address text;

create index if not exists audit_logs_user_id_idx on public.audit_logs (user_id);
create index if not exists audit_logs_table_record_idx on public.audit_logs (table_name, record_id);

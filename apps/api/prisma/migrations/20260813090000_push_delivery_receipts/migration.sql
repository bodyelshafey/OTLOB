-- Tracks per-device push delivery status using Expo's two-step
-- send-then-check-receipts flow: a row is created SENT (or FAILED /
-- INVALID_TOKEN immediately, from the send ticket) when a push is
-- dispatched, then updated to DELIVERED/FAILED/INVALID_TOKEN once the
-- delayed receipt-check job processes Expo's actual delivery receipt.

create table if not exists public.push_deliveries (
  id uuid primary key default gen_random_uuid(),
  token text not null,
  ticket_id text,
  status text not null default 'QUEUED',
  error_message text,
  created_at timestamptz not null default now(),
  checked_at timestamptz
);

create index if not exists push_deliveries_status_idx on public.push_deliveries (status);

alter table public.push_deliveries enable row level security;

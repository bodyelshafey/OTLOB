-- Adds email verification (OTP) to the auth flow: register no longer
-- issues tokens directly — the account is created unverified, a 6-digit
-- code is emailed, and POST /auth/verify-email exchanges a valid code for
-- tokens. Login is blocked for unverified accounts.

alter table public.users
  add column if not exists is_verified boolean not null default false;

-- Existing accounts predate this feature — don't lock out everyone who
-- already has a working account by defaulting them to unverified.
update public.users set is_verified = true where is_verified = false;

create table if not exists public.verification_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  code_hash text not null,
  purpose text not null default 'EMAIL_VERIFICATION',
  attempts integer not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists verification_codes_user_id_idx on public.verification_codes (user_id);

alter table public.verification_codes enable row level security;

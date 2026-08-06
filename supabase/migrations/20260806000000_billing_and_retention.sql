-- Billing correctness + annual pricing + cancellation retention.
--
-- Additive and re-runnable. Everything is guarded so this can be applied to a
-- project whose baseline schema was created by hand.
--
-- Order matters: the de-duplication blocks must run before their matching
-- unique indexes, or index creation fails on existing bad data.

begin;

-- ---------------------------------------------------------------------------
-- 1. professor_subscriptions: columns the billing rewrite depends on
-- ---------------------------------------------------------------------------

-- The first six are pre-existing in most deployments; they are listed anyway
-- because the schema has drifted from the code and a missing one would abort
-- this migration at a later statement. Every column here is read or written by
-- src/lib/subscriptions.ts or the Stripe webhook.
alter table public.professor_subscriptions
    add column if not exists plan_tier text not null default 'free',
    add column if not exists status text not null default 'free',
    add column if not exists stripe_customer_id text,
    add column if not exists stripe_subscription_id text,
    add column if not exists stripe_price_id text,
    add column if not exists current_period_start timestamptz,
    add column if not exists current_period_end timestamptz,
    add column if not exists cancel_at_period_end boolean not null default false,
    add column if not exists grace_until timestamptz,
    add column if not exists is_disabled boolean not null default false,
    add column if not exists created_at timestamptz not null default now(),
    add column if not exists updated_at timestamptz not null default now(),
    add column if not exists billing_interval text not null default 'month',
    -- Guards against Stripe's out-of-order webhook delivery. A stale
    -- subscription.updated arriving after subscription.deleted must not
    -- resurrect a cancelled subscription.
    add column if not exists last_stripe_event_at timestamptz,
    -- Set when a subscription is paused through the retention flow. Entitlement
    -- resolution reads this directly: a paused subscription keeps status
    -- 'active' in Stripe, so without this column a pause would grant free Pro.
    add column if not exists paused_until timestamptz,
    -- One retention offer per rolling 12 months, so a customer cannot
    -- repeatedly cancel-and-claim.
    add column if not exists retention_offer_claimed_at timestamptz;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'professor_subscriptions_billing_interval_check'
    ) then
        alter table public.professor_subscriptions
            add constraint professor_subscriptions_billing_interval_check
            check (billing_interval in ('month', 'year'));
    end if;
end $$;

-- One subscription row per user, and one user per Stripe customer. The webhook
-- upsert targets user_id, so that constraint is load-bearing.
create unique index if not exists professor_subscriptions_user_id_key
    on public.professor_subscriptions (user_id);

create unique index if not exists professor_subscriptions_stripe_customer_id_key
    on public.professor_subscriptions (stripe_customer_id)
    where stripe_customer_id is not null;

-- ---------------------------------------------------------------------------
-- 2. Stripe webhook audit trail and idempotency
-- ---------------------------------------------------------------------------
-- Audit trail for every Stripe delivery. The webhook's writes here are wrapped
-- in try/catch so a missing table degrades rather than fails, but without it
-- you lose the record of what Stripe sent and how it resolved — the first thing
-- you want when a subscription looks wrong.
create table if not exists public.webhook_logs (
    id                     uuid primary key default gen_random_uuid(),
    stripe_event_id        text,
    event_type             text,
    stripe_customer_id     text,
    stripe_subscription_id text,
    user_id                uuid,
    resolved_plan_tier     text,
    status                 text,
    payload                jsonb,
    error                  text,
    created_at             timestamptz not null default now()
);

alter table public.webhook_logs enable row level security;

-- The dedupe key, deliberately separate from webhook_logs: that table records
-- signature failures under a placeholder event id, which would collide under a
-- unique constraint. This one is the idempotency claim and nothing else.
create table if not exists public.stripe_processed_events (
    stripe_event_id text primary key,
    event_type      text not null,
    processed_at    timestamptz not null default now()
);

alter table public.stripe_processed_events enable row level security;

-- No policies on either: both are reached only by the service-role client,
-- which bypasses RLS. Enabled explicitly so neither is ever accidentally
-- exposed through PostgREST.

-- ---------------------------------------------------------------------------
-- 3. Cancellation retention funnel
-- ---------------------------------------------------------------------------

create table if not exists public.retention_events (
    id             uuid primary key default gen_random_uuid(),
    user_id        uuid not null references auth.users (id) on delete cascade,
    reason         text,
    offer_shown    text,
    offer_accepted boolean not null default false,
    outcome        text,
    created_at     timestamptz not null default now()
);

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'retention_events_outcome_check'
    ) then
        alter table public.retention_events
            add constraint retention_events_outcome_check
            check (outcome is null or outcome in (
                'retained_annual',
                'retained_downgrade',
                'retained_pause',
                'retained_feedback',
                'cancelled'
            ));
    end if;
end $$;

create index if not exists retention_events_user_id_idx
    on public.retention_events (user_id, created_at desc);

alter table public.retention_events enable row level security;

-- Service-role only, same rationale as above.

-- ---------------------------------------------------------------------------
-- 4. attendance_records: reconcile with what the application writes
-- ---------------------------------------------------------------------------
-- The live table predates several features, so columns the code already
-- inserts are missing. /api/attend writes device_id and device_fingerprint on
-- every check-in, and the attendance-override route writes recorded_via, note,
-- and overridden_by — a missing column makes PostgREST reject the whole insert,
-- so check-in fails rather than degrading.
--
-- recorded_via defaults to 'qr', which backfills existing rows. Every record
-- created before manual override existed came from the QR flow, and the
-- override route reads this column to refuse replacing a genuine check-in;
-- leaving it null would quietly disable that guard.

alter table public.attendance_records
    add column if not exists device_id text,
    add column if not exists device_fingerprint text,
    add column if not exists recorded_via text not null default 'qr',
    add column if not exists note text,
    add column if not exists overridden_by uuid,
    add column if not exists updated_at timestamptz;

-- ---------------------------------------------------------------------------
-- 4b. Close the check-then-insert race
-- ---------------------------------------------------------------------------
-- The API currently checks for an existing record and then inserts, so two
-- concurrent check-ins can both pass the check. These indexes are the real
-- guarantee; the route handles 23505 as "already checked in".
--
-- Existing duplicates must go first or index creation fails. Earliest record
-- wins, which matches the product semantic: your first check-in is the one
-- that counts.

delete from public.attendance_records a
using public.attendance_records b
where a.session_id = b.session_id
  and a.student_id = b.student_id
  and a.ctid > b.ctid;

create unique index if not exists attendance_records_session_student_key
    on public.attendance_records (session_id, student_id);

delete from public.attendance_records a
using public.attendance_records b
where a.session_id = b.session_id
  and a.device_id = b.device_id
  and a.device_id is not null
  and a.ctid > b.ctid;

create unique index if not exists attendance_records_session_device_key
    on public.attendance_records (session_id, device_id)
    where device_id is not null;

commit;

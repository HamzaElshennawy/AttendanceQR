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

alter table public.professor_subscriptions
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
-- 2. Stripe webhook idempotency
-- ---------------------------------------------------------------------------
-- Deliberately separate from webhook_logs: that table is an append-only audit
-- trail that also records signature failures under a placeholder event id,
-- which would collide under a unique constraint. This table is the dedupe key
-- and nothing else.

create table if not exists public.stripe_processed_events (
    stripe_event_id text primary key,
    event_type      text not null,
    processed_at    timestamptz not null default now()
);

alter table public.stripe_processed_events enable row level security;

-- No policies: reached only by the service-role client, which bypasses RLS.
-- Enabled explicitly so the table is never accidentally exposed via PostgREST.

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
-- 4. attendance_records: close the check-then-insert race
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

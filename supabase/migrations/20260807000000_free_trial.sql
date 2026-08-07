-- Free trial on first paid subscription.
--
-- Additive and re-runnable, matching the convention of the billing migration.
-- Stripe is the source of truth for the trial window itself; these columns
-- mirror it so entitlement checks and the settings UI never have to call the
-- Stripe API on a page render.

begin;

alter table public.professor_subscriptions
    -- Mirrored from the Stripe subscription's trial_start / trial_end on every
    -- subscription webhook. Both stay populated after the trial converts, so
    -- they double as a record of when the customer first started.
    add column if not exists trial_started_at timestamptz,
    add column if not exists trial_ends_at timestamptz,
    -- Sticky: set when a trial begins and never cleared. Without it, cancelling
    -- and re-subscribing would hand out an unlimited series of free trials.
    add column if not exists has_used_trial boolean not null default false;

-- Backfill. Anyone who already reached Stripe has had their shot at an
-- introductory offer, so they are not handed a trial retroactively when this
-- ships. Scoped to rows where the flag is still at its default, which keeps the
-- statement idempotent across re-runs.
update public.professor_subscriptions
set has_used_trial = true
where has_used_trial = false
  and (stripe_subscription_id is not null or trial_ends_at is not null);

-- Partial index: the settings page reads a single user's row by user_id, but
-- the trial-expiry sweep (and any "trials ending this week" reporting) scans by
-- date across only the rows that ever had a trial.
create index if not exists professor_subscriptions_trial_ends_at_idx
    on public.professor_subscriptions (trial_ends_at)
    where trial_ends_at is not null;

commit;

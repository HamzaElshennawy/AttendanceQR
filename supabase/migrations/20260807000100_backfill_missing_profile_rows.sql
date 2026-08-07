-- Backfill professors and professor_subscriptions for pre-trigger accounts.
--
-- handle_new_user (20260806000200) creates both rows, but it only fires on
-- INSERT into auth.users — every account that existed before it shipped still
-- has neither. The symptoms are a 406 from PostgREST on the dashboard's
-- `.single()` profile lookup, and a 500 from /api/billing/summary, because
-- getOrCreateSubscriptionRecord falls through to its upsert path on every
-- request for those users.
--
-- Idempotent: both statements skip users who already have a row, so this is
-- safe to re-run and safe to apply before or after the trial migration.

begin;

insert into public.professors (id, name, email, university)
select
    users.id,
    -- Mirrors the trigger's fallback so a backfilled profile is named the same
    -- way a freshly registered one would be.
    coalesce(
        nullif(trim(users.raw_user_meta_data ->> 'name'), ''),
        split_part(users.email, '@', 1)
    ),
    users.email,
    nullif(trim(users.raw_user_meta_data ->> 'university'), '')
from auth.users as users
where users.email is not null
on conflict (id) do nothing;

insert into public.professor_subscriptions (
    user_id, plan_tier, status, billing_interval,
    cancel_at_period_end, is_disabled
)
select users.id, 'free', 'free', 'month', false, false
from auth.users as users
on conflict (user_id) do nothing;

commit;

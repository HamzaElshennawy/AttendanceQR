-- Create the professor profile and subscription row from a database trigger.
--
-- Registration previously ran through supabaseAdmin.auth.admin.createUser with
-- email_confirm: true, which skipped Supabase's own signup protections and
-- verified nobody's email — anyone could register any address. Moving row
-- creation into a trigger lets the route use the ordinary signUp() flow, and
-- removes the hand-rolled rollback (delete profile, delete auth user) that ran
-- outside any transaction and could leave orphans behind.

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.professors (id, name, email, university)
    values (
        new.id,
        -- Falls back to the local part of the address so the profile is never
        -- nameless if metadata is missing.
        coalesce(
            nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
            split_part(new.email, '@', 1)
        ),
        new.email,
        nullif(trim(new.raw_user_meta_data ->> 'university'), '')
    )
    on conflict (id) do nothing;

    insert into public.professor_subscriptions (
        user_id, plan_tier, status, billing_interval,
        cancel_at_period_end, is_disabled
    )
    values (new.id, 'free', 'free', 'month', false, false)
    on conflict (user_id) do nothing;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
    after insert on auth.users
    for each row
    execute function public.handle_new_user();

-- Backfill anyone who registered before this trigger existed.
insert into public.professor_subscriptions (
    user_id, plan_tier, status, billing_interval,
    cancel_at_period_end, is_disabled
)
select p.id, 'free', 'free', 'month', false, false
from public.professors p
left join public.professor_subscriptions s on s.user_id = p.id
where s.user_id is null;

commit;

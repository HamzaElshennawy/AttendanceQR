-- Fixed-window rate limiting, backed by Postgres.
--
-- Deliberately not Redis/Upstash: this needs no additional service or
-- credentials, and the request volume here (classroom check-ins, signups,
-- exam starts) is nowhere near the point where a dedicated store earns its
-- operational cost.

begin;

create table if not exists public.rate_limits (
    key          text primary key,
    window_start timestamptz not null default now(),
    count        integer not null default 0
);

-- Supports pruning expired windows.
create index if not exists rate_limits_window_start_idx
    on public.rate_limits (window_start);

alter table public.rate_limits enable row level security;
-- No policies: reached only by the service-role client.

/*
 * Records a hit and reports whether the caller is still within its allowance.
 *
 * Returns true when the request is allowed. The whole check is a single
 * statement so concurrent requests cannot interleave a read and a write and
 * both conclude they are under the limit.
 */
create or replace function public.check_rate_limit(
    p_key            text,
    p_limit          integer,
    p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_now     timestamptz := now();
    v_expires timestamptz := now() - make_interval(secs => p_window_seconds);
    v_count   integer;
begin
    insert into public.rate_limits as existing (key, window_start, count)
    values (p_key, v_now, 1)
    on conflict (key) do update
        set count = case
                when existing.window_start < v_expires then 1
                else existing.count + 1
            end,
            window_start = case
                when existing.window_start < v_expires then v_now
                else existing.window_start
            end
    returning existing.count into v_count;

    return v_count <= p_limit;
end;
$$;

/*
 * Housekeeping. Safe to call from a cron job; nothing depends on rows
 * surviving past their window.
 */
create or replace function public.prune_rate_limits(p_older_than_hours integer default 24)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_deleted integer;
begin
    delete from public.rate_limits
    where window_start < now() - make_interval(hours => p_older_than_hours);

    get diagnostics v_deleted = row_count;
    return v_deleted;
end;
$$;

commit;

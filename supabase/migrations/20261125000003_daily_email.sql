-- Daily low-stock email: pg_cron calls the daily-email Edge Function hourly; the function only
-- sends at 09:00 Europe/Berlin on weekdays, and claim_daily_email() makes sure it sends once per day.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table public.email_state (
  id           int primary key default 1 check (id = 1),
  last_sent_on date
);
insert into public.email_state (id) values (1);
alter table public.email_state enable row level security;  -- no policies: not reachable from the app

create or replace function public.claim_daily_email(p_day date)
returns boolean
language sql as $$
  update public.email_state set last_sent_on = p_day
   where id = 1 and (last_sent_on is null or last_sent_on < p_day)
  returning true;
$$;
revoke execute on function public.claim_daily_email(date) from public, anon, authenticated;
grant  execute on function public.claim_daily_email(date) to service_role;

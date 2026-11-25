-- Newer Supabase projects don't grant table access to API roles by default: grant exactly what the app needs.
grant usage on schema public to authenticated, service_role;

grant select, update on public.items     to authenticated;
grant select, insert on public.count_log to authenticated;

grant select         on public.items       to service_role;
grant select, update on public.email_state to service_role;

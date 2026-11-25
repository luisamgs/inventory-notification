-- Buchkantine inventory: schema + RLS (only authenticated team login can read/write)

create table public.items (
  id              uuid primary key default gen_random_uuid(),
  list            text not null check (list in ('ingredient','production')),
  provider        text,                       -- ingredients only
  category        text,                       -- ingredients only
  type            text check (type in ('waffles','flammkuchen','breakfast','lunch_dinner')),  -- production only; same as the 4 form sections
  form_section    text,                       -- original section on the printed form
  name            text not null,
  unit            text,                       -- shown next to the count, editable in the app
  min_qty         numeric(8,1) not null default 0 check (min_qty >= 0 and min_qty * 2 = trunc(min_qty * 2)),
  current_qty     numeric(8,1) not null default 0 check (current_qty >= 0 and current_qty * 2 = trunc(current_qty * 2)),
  last_counted_by text,
  last_counted_at timestamptz,
  sort_order      int not null default 0
);
create index on public.items (list, provider, category, type);

create table public.count_log (
  id          bigint generated always as identity primary key,
  item_id     uuid not null references public.items(id) on delete cascade,
  item_name   text not null,
  old_qty     numeric(8,1) not null,
  new_qty     numeric(8,1) not null,
  counted_by  text not null,
  counted_at  timestamptz not null default now()
);
create index on public.count_log (item_id, counted_at desc);

alter table public.items     enable row level security;
alter table public.count_log enable row level security;

create policy items_read   on public.items     for select to authenticated using (true);
create policy items_update on public.items     for update to authenticated using (true) with check (true);
create policy log_read     on public.count_log  for select to authenticated using (true);
create policy log_insert   on public.count_log  for insert to authenticated with check (true);

-- One call = update the count AND write the log row, atomically.
create or replace function public.set_count(p_item uuid, p_qty numeric, p_by text)
returns public.items
language plpgsql security invoker as $$
declare it public.items;
begin
  select * into it from public.items where id = p_item for update;
  if not found then raise exception 'item not found'; end if;
  insert into public.count_log(item_id, item_name, old_qty, new_qty, counted_by)
    values (it.id, it.name, it.current_qty, p_qty, p_by);
  update public.items
     set current_qty = p_qty, last_counted_by = p_by, last_counted_at = now()
   where id = p_item returning * into it;
  return it;
end $$;

revoke execute on function public.set_count(uuid, numeric, text) from public, anon;
grant  execute on function public.set_count(uuid, numeric, text) to authenticated;

-- Roomie schema for Supabase
-- Run in SQL editor or via psql. Idempotent-ish (drops policies before re-creating).

create extension if not exists pgcrypto;

-- ============ TABLES ============

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text,
  invite_code text not null unique,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  unique (household_id, user_id)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  description text,
  category text not null default 'other',
  assigned_to uuid references auth.users(id),
  created_by uuid not null references auth.users(id),
  due_date date,
  due_time time,
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  status text not null default 'pending' check (status in ('pending','in_progress','completed')),
  recurrence text not null default 'none' check (recurrence in ('none','daily','weekly','monthly')),
  rotate boolean not null default false,
  completed_by uuid references auth.users(id),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  category text not null default 'other',
  quantity numeric not null default 0 check (quantity >= 0),
  unit text not null default 'pcs',
  purchase_date date,
  expiry_date date,
  estimated_cost numeric,
  minimum_quantity numeric,
  added_by uuid references auth.users(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.grocery_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  category text not null default 'other',
  quantity numeric not null default 1 check (quantity > 0),
  unit text not null default 'pcs',
  estimated_price numeric,
  actual_price numeric,
  source text not null default 'manual' check (source in ('manual','low_stock','ai_meal','recurring')),
  source_reference text,
  added_by uuid references auth.users(id),
  purchased boolean not null default false,
  purchased_by uuid references auth.users(id),
  purchased_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  amount numeric not null check (amount > 0),
  category text not null default 'other',
  paid_by uuid not null references auth.users(id),
  expense_date date not null default current_date,
  notes text,
  from_budget boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  share_amount numeric not null check (share_amount >= 0),
  settled boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  from_user uuid not null references auth.users(id),
  to_user uuid not null references auth.users(id),
  amount numeric not null check (amount > 0),
  settled_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid references auth.users(id),
  type text not null check (type in ('contribution','expense','refund','adjustment')),
  amount numeric not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  description text,
  category text not null default 'other',
  event_date date not null,
  event_time time,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  content text,
  sensitive boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  meal_date date not null,
  meal_type text not null default 'dinner',
  meal_name text not null,
  recipe_data jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.ai_meal_history (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  requested_by uuid references auth.users(id),
  prompt text,
  meals jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid references public.households(id) on delete cascade,
  type text not null default 'general',
  title text not null,
  message text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  diet_type text not null default 'none',
  allergies text[] not null default '{}',
  disliked_foods text[] not null default '{}',
  notification_settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ HELPERS ============

create or replace function public.is_household_member(hid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = hid and user_id = auth.uid()
  );
$$;

create or replace function public.is_household_owner(hid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = hid and user_id = auth.uid() and role = 'owner'
  );
$$;

-- invite-code preview + join (security definer so non-members can look up by code)
create or replace function public.get_household_by_invite(code text)
returns table (id uuid, name text, icon text, invite_code text, member_count bigint, members jsonb)
language sql stable security definer set search_path = public
as $$
  select h.id, h.name, h.icon, h.invite_code,
    (select count(*) from public.household_members hm where hm.household_id = h.id) as member_count,
    (select coalesce(jsonb_agg(jsonb_build_object('name', coalesce(p.full_name, split_part(p.email,'@',1)), 'avatar', p.avatar_url, 'role', hm.role) order by hm.joined_at), '[]'::jsonb)
       from public.household_members hm join public.profiles p on p.id = hm.user_id
       where hm.household_id = h.id) as members
  from public.households h
  where upper(h.invite_code) = upper(trim(code))
  limit 1;
$$;

create or replace function public.join_household(code text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare h_id uuid;
begin
  select h.id into h_id from public.households h where upper(h.invite_code) = upper(trim(code)) limit 1;
  if h_id is null then
    raise exception 'Invalid invite code';
  end if;
  insert into public.household_members (household_id, user_id, role)
  values (h_id, auth.uid(), 'member')
  on conflict (household_id, user_id) do nothing;
  return h_id;
end;
$$;

-- new-user profile trigger
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_inventory on public.inventory_items;
create trigger touch_inventory before update on public.inventory_items
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_notes on public.notes;
create trigger touch_notes before update on public.notes
  for each row execute function public.touch_updated_at();

-- ============ RLS ============

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.tasks enable row level security;
alter table public.inventory_items enable row level security;
alter table public.grocery_items enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;
alter table public.settlements enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.calendar_events enable row level security;
alter table public.notes enable row level security;
alter table public.meal_plans enable row level security;
alter table public.ai_meal_history enable row level security;
alter table public.notifications enable row level security;
alter table public.user_preferences enable row level security;

-- profiles: see self + members of your households
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid() or exists (
    select 1 from public.household_members a
    join public.household_members b on b.household_id = a.household_id
    where a.user_id = auth.uid() and b.user_id = profiles.id
  )
);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid());

-- households
drop policy if exists households_select on public.households;
create policy households_select on public.households for select to authenticated
  using (public.is_household_member(id) or created_by = auth.uid());
drop policy if exists households_insert on public.households;
create policy households_insert on public.households for insert to authenticated
  with check (created_by = auth.uid());
drop policy if exists households_update on public.households;
create policy households_update on public.households for update to authenticated
  using (public.is_household_owner(id)) with check (public.is_household_owner(id));

-- household_members
drop policy if exists hm_select on public.household_members;
create policy hm_select on public.household_members for select to authenticated
  using (public.is_household_member(household_id) or user_id = auth.uid());
drop policy if exists hm_insert on public.household_members;
create policy hm_insert on public.household_members for insert to authenticated
  with check (user_id = auth.uid() or public.is_household_owner(household_id));
drop policy if exists hm_delete on public.household_members;
create policy hm_delete on public.household_members for delete to authenticated
  using (user_id = auth.uid() or public.is_household_owner(household_id));

-- generic per-household policies
-- (macro-style: repeated per table)
drop policy if exists tasks_all on public.tasks;
create policy tasks_all on public.tasks for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists inventory_all on public.inventory_items;
create policy inventory_all on public.inventory_items for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists grocery_all on public.grocery_items;
create policy grocery_all on public.grocery_items for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists expenses_all on public.expenses;
create policy expenses_all on public.expenses for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- expense_splits: member of the expense's household
drop policy if exists splits_all on public.expense_splits;
create policy splits_all on public.expense_splits for all to authenticated
  using (exists (
    select 1 from public.expenses e
    where e.id = expense_splits.expense_id and public.is_household_member(e.household_id)
  ))
  with check (exists (
    select 1 from public.expenses e
    where e.id = expense_splits.expense_id and public.is_household_member(e.household_id)
  ));

drop policy if exists settlements_all on public.settlements;
create policy settlements_all on public.settlements for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists wallet_all on public.wallet_transactions;
create policy wallet_all on public.wallet_transactions for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists calendar_all on public.calendar_events;
create policy calendar_all on public.calendar_events for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists notes_all on public.notes;
create policy notes_all on public.notes for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists meal_plans_all on public.meal_plans;
create policy meal_plans_all on public.meal_plans for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists ai_history_all on public.ai_meal_history;
create policy ai_history_all on public.ai_meal_history for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications for insert to authenticated
  with check (public.is_household_member(household_id));
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists prefs_all on public.user_preferences;
create policy prefs_all on public.user_preferences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============ REALTIME ============

do $$
begin
  begin alter publication supabase_realtime add table public.tasks; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.inventory_items; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.grocery_items; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.expenses; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.expense_splits; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.settlements; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.wallet_transactions; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.calendar_events; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.notes; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.household_members; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end;
end $$;

-- ============ v2: inventory usage log (waste-saver digest) ============
create table if not exists public.inventory_usage (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  item_name text not null,
  quantity numeric not null check (quantity > 0),
  unit text not null default 'pcs',
  estimated_value numeric not null default 0,
  days_to_expiry integer,
  source text not null default 'manual' check (source in ('manual','cook')),
  used_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.inventory_usage enable row level security;
drop policy if exists usage_all on public.inventory_usage;
create policy usage_all on public.inventory_usage for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
do $$ begin
  begin alter publication supabase_realtime add table public.inventory_usage; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.meal_plans; exception when duplicate_object then null; end;
end $$;

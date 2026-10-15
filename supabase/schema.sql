create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  description text not null check (char_length(description) between 1 and 60),
  amount numeric(12, 2) not null check (amount > 0),
  category text not null check (
    category in ('Food & drink', 'Transport', 'Study', 'Social', 'Essentials', 'Other')
  ),
  date date not null,
  created_at timestamptz not null default now()
);

create index expenses_user_date_idx on public.expenses (user_id, date desc);

alter table public.expenses enable row level security;

create policy "Users can view their own expenses"
  on public.expenses for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add their own expenses"
  on public.expenses for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own expenses"
  on public.expenses for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own expenses"
  on public.expenses for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.expenses from anon, authenticated;
grant select, insert, update, delete on public.expenses to authenticated;

create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  monthly_budget numeric(12, 2) not null default 0 check (monthly_budget >= 0),
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "Users can view their own settings"
  on public.user_settings for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add their own settings"
  on public.user_settings for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own settings"
  on public.user_settings for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.user_settings from anon, authenticated;
grant select, insert, update on public.user_settings to authenticated;

-- @auto-migrate
-- Multiple receipt files (photos/PDFs) can be attached to a single trip expense.

create table if not exists public.trip_expense_receipts (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.trip_expenses(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  file_url text not null,
  file_name text not null,
  file_type text not null default 'application/octet-stream',
  file_size bigint,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists trip_expense_receipts_expense_id_idx
  on public.trip_expense_receipts(expense_id);
create index if not exists trip_expense_receipts_trip_id_idx
  on public.trip_expense_receipts(trip_id);

alter table public.trip_expense_receipts enable row level security;

drop policy if exists "admins_manage_expense_receipts" on public.trip_expense_receipts;
create policy "admins_manage_expense_receipts"
  on public.trip_expense_receipts
  for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = any (array['super_admin', 'admin', 'trip_admin'])
    )
  );

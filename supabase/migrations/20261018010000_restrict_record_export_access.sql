drop policy if exists "Public can verify exports by ID"
  on public.record_exports;

drop policy if exists "Users can insert own exports"
  on public.record_exports;

create policy "Users can insert legacy exports"
  on public.record_exports
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and record_snapshot is null
  );

comment on policy "Users can insert legacy exports" on public.record_exports is
  'Temporary compatibility policy: clients may create legacy exports, but cannot submit verification snapshots.';

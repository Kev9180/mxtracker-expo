-- ============================================================
-- Audit log for maintenance_records changes
-- Captures field-level changes on every update so exports
-- can show a full tamper-evident modification history.
-- ============================================================

create table maintenance_record_audit (
  id                    uuid primary key default gen_random_uuid(),
  maintenance_record_id uuid not null references maintenance_records(id) on delete cascade,
  user_id               uuid not null references auth.users(id) on delete cascade,
  change_type           text not null check (change_type in ('created', 'updated', 'deleted')),
  changed_fields        text[],       -- e.g. ['completed_date', 'mileage_at_service']
  old_values            jsonb,        -- snapshot of fields before change
  new_values            jsonb,        -- snapshot of fields after change
  changed_at            timestamptz not null default now()
);

comment on table maintenance_record_audit is 'Full change history for every maintenance record. Used in PDF exports to show modification timeline.';

-- Index for fast lookup when building an export
create index on maintenance_record_audit (maintenance_record_id, changed_at);


-- ============================================================
-- Record exports ledger
-- One row per export action. Used to verify PDF authenticity
-- via the mxtracker.app/verify/{id} endpoint.
-- ============================================================

create table record_exports (
  id             uuid primary key default gen_random_uuid(),
  vehicle_id     uuid not null references vehicles(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  record_count   integer not null,
  export_hash    text not null,      -- SHA-256 of serialized record snapshot
  exported_at    timestamptz not null default now()
);

comment on table record_exports is 'Ledger of all PDF exports. Export hash allows third parties to verify a PDF was not tampered with after export.';


-- ============================================================
-- Trigger: auto-audit on maintenance_record INSERT / UPDATE
-- ============================================================

create or replace function audit_maintenance_record()
returns trigger as $$
declare
  changed text[] := '{}';
  old_snap jsonb := '{}';
  new_snap jsonb := '{}';
  col text;
  tracked_cols text[] := array[
    'task_name', 'completed_date', 'mileage_at_service',
    'performed_by', 'cost', 'notes',
    'is_recurring', 'interval_years', 'interval_months', 'interval_days'
  ];
begin
  if tg_op = 'INSERT' then
    insert into maintenance_record_audit
      (maintenance_record_id, user_id, change_type, changed_fields, old_values, new_values)
    values
      (new.id, new.user_id, 'created', null, null,
       to_jsonb(new) - 'id' - 'user_id' - 'vehicle_id' - 'created_at' - 'updated_at');
    return new;
  end if;

  if tg_op = 'UPDATE' then
    foreach col in array tracked_cols loop
      if to_jsonb(new) -> col is distinct from to_jsonb(old) -> col then
        changed := array_append(changed, col);
        old_snap := old_snap || jsonb_build_object(col, to_jsonb(old) -> col);
        new_snap := new_snap || jsonb_build_object(col, to_jsonb(new) -> col);
      end if;
    end loop;

    -- Only log if something actually changed
    if array_length(changed, 1) > 0 then
      insert into maintenance_record_audit
        (maintenance_record_id, user_id, change_type, changed_fields, old_values, new_values)
      values
        (new.id, new.user_id, 'updated', changed, old_snap, new_snap);
    end if;
    return new;
  end if;

  return null;
end;
$$ language plpgsql security definer;

create trigger maintenance_records_audit
  after insert or update on maintenance_records
  for each row execute function audit_maintenance_record();


-- ============================================================
-- RLS policies
-- ============================================================

alter table maintenance_record_audit enable row level security;
alter table record_exports enable row level security;

-- Users can only read their own audit logs
create policy "Users can read own audit logs"
  on maintenance_record_audit for select
  using (auth.uid() = user_id);

-- Users can only read their own exports
create policy "Users can read own exports"
  on record_exports for select
  using (auth.uid() = user_id);

-- Users can insert their own exports
create policy "Users can insert own exports"
  on record_exports for insert
  with check (auth.uid() = user_id);

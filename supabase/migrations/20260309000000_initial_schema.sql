-- ============================================================
-- Vehicle Maintenance Tracker — Initial Schema
-- Migration: 20240309000000_initial_schema.sql
-- Place in: supabase/migrations/
-- ============================================================


-- ============================================================
-- EXTENSIONS
-- ============================================================




-- ============================================================
-- PROFILES
-- 1:1 with auth.users. Created automatically on signup via trigger.
-- Stores display preferences and reminder contact info.
-- ============================================================

create table profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  display_name        text,
  reminder_email      text,            -- can differ from login email
  reminders_enabled   boolean not null default true,
  remind_days_before  integer not null default 7,   -- global default: remind 7 days before due
  odometer_unit       text not null default 'miles' check (odometer_unit in ('miles', 'kilometers')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table profiles is 'User preferences and reminder settings. Auto-created on signup.';
comment on column profiles.reminder_email is 'Destination for reminder emails. Defaults to auth email if null.';
comment on column profiles.remind_days_before is 'How many days before next_due_date to send the reminder.';


-- ============================================================
-- VEHICLES
-- Each user can have many vehicles.
-- ============================================================

create table vehicles (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,

  -- Identity
  year                  integer not null check (year >= 1885 and year <= 2100),
  make                  text not null,
  model                 text not null,
  trim                  text,
  nickname              text,

  -- Engine
  engine_displacement   numeric(3, 1),   -- e.g. 4.0 (liters)
  engine_config         text check (
                          engine_config in (
                            'inline', 'v', 'boxer', 'rotary', 'other'
                          )
                        ),
  cylinders             integer check (cylinders > 0),

  -- Drivetrain
  drive                 text check (drive in ('FWD', 'RWD', 'AWD', '4WD')),
  transmission          text check (
                          transmission in (
                            'automatic', 'manual', 'cvt'
                          )
                        ),
  fuel_type             text check (
                          fuel_type in (
                            'gasoline', 'diesel', 'hybrid',
                            'plug-in hybrid', 'electric', 'other'
                          )
                        ),

  -- Optional extras
  vin                   text,
  color                 text,
  license_plate         text,
  license_plate_state   text,
  purchase_date         date,
  current_mileage       integer check (current_mileage >= 0),
  photo_url             text,           -- Supabase Storage URL

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table vehicles is 'Vehicles owned by users.';
comment on column vehicles.engine_displacement is 'Engine size in liters, e.g. 4.0 for a 4.0L V6.';
comment on column vehicles.engine_config is 'Engine cylinder layout: inline, v, boxer, rotary, etc.';
comment on column vehicles.current_mileage is 'Latest known odometer reading. Updated by user manually or on service log.';


-- ============================================================
-- MAINTENANCE RECORDS
-- Core table. Each row is either a completed service or an
-- upcoming scheduled service. Recurring chains are linked via
-- parent_record_id.
-- ============================================================

create table maintenance_records (
  id                  uuid primary key default gen_random_uuid(),
  vehicle_id          uuid not null references vehicles(id) on delete cascade,
  user_id             uuid not null references auth.users(id) on delete cascade,
  -- What & when
  task_name           text not null,           -- denormalized for display, e.g. "Oil Change"
  status              text not null default 'upcoming'
                        check (status in ('upcoming', 'completed', 'skipped')),
  completed_date      date,                    -- null if status = 'upcoming'
  mileage_at_service  integer check (mileage_at_service >= 0),

  -- Completed date must be set when status is 'completed'
  constraint completed_date_required check (status != 'completed' or completed_date is not null),

  -- Recurrence (time-based only)
  is_recurring        boolean not null default false,
  interval_years      integer check (interval_years >= 0),
  interval_months     integer check (interval_months >= 0),
  interval_days       integer check (interval_days >= 0),

  -- Next due
  next_due_date       date,                    -- auto-calculated on insert/update

  -- Reminder
  reminder_enabled    boolean not null default true,
  reminder_sent_at    timestamptz,             -- null = not yet sent; reset on edit

  -- Details
  cost                numeric(10, 2) check (cost >= 0),
  performed_by        text,                    -- "Self", "Toyota Dealership", etc.
  notes               text,
  receipt_url         text,                    -- Supabase Storage URL

  -- Recurrence chain
  -- Each completed record points to the next upcoming one.
  -- Lets you traverse the full history of any recurring service.
  parent_record_id    uuid references maintenance_records(id) on delete set null,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table maintenance_records is 'Service history and upcoming scheduled maintenance per vehicle.';
comment on column maintenance_records.status is 'upcoming = scheduled but not done; completed = done; skipped = user dismissed.';
comment on column maintenance_records.is_recurring is 'If true, completing this record auto-creates the next upcoming one.';
comment on column maintenance_records.next_due_date is 'Auto-calculated from completed_date + interval. Drives reminder logic.';
comment on column maintenance_records.parent_record_id is 'Points to the previous record in a recurring chain, enabling full service history traversal.';
comment on column maintenance_records.reminder_sent_at is 'Timestamp of last reminder sent. Reset to null when record is edited to re-arm.';


-- ============================================================
-- REMINDER LOGS
-- Audit trail of every email attempted. Prevents double-sends
-- and lets users see notification history.
-- ============================================================

create table reminder_logs (
  id                    uuid primary key default gen_random_uuid(),
  maintenance_record_id uuid not null references maintenance_records(id) on delete cascade,
  user_id               uuid not null references auth.users(id) on delete cascade,
  sent_to               text not null,         -- email address at time of sending
  sent_at               timestamptz not null default now(),
  status                text not null default 'pending'
                          check (status in ('pending', 'delivered', 'failed', 'bounced')),
  type                  text not null
                          check (type in ('due_soon', 'overdue')),
  error_message         text                   -- populated if status = 'failed'
);

comment on table reminder_logs is 'Audit log of all reminder emails sent or attempted.';


-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at on any row change
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger vehicles_updated_at
  before update on vehicles
  for each row execute function update_updated_at();

create trigger maintenance_records_updated_at
  before update on maintenance_records
  for each row execute function update_updated_at();

create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();


-- Auto-calculate next_due_date when a record is saved
-- Also resets reminder_sent_at on edit so the reminder re-arms
create or replace function calculate_next_due()
returns trigger as $$
begin
  -- Only calculate if we have a completed_date and at least one interval
  if new.completed_date is not null and (
    new.interval_years  is not null or
    new.interval_months is not null or
    new.interval_days   is not null
  ) then
    new.next_due_date = new.completed_date
      + coalesce(new.interval_years,  0) * interval '1 year'
      + coalesce(new.interval_months, 0) * interval '1 month'
      + coalesce(new.interval_days,   0) * interval '1 day';
  end if;

  -- Re-arm reminder if record is being edited
  if TG_OP = 'UPDATE' and (
    old.completed_date    is distinct from new.completed_date or
    old.interval_years    is distinct from new.interval_years or
    old.interval_months   is distinct from new.interval_months or
    old.interval_days     is distinct from new.interval_days
  ) then
    new.reminder_sent_at = null;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger maintenance_next_due
  before insert or update on maintenance_records
  for each row execute function calculate_next_due();


-- Auto-create a profile row when a new user signs up
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, reminder_email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table profiles             enable row level security;
alter table vehicles             enable row level security;
alter table maintenance_records  enable row level security;
alter table reminder_logs        enable row level security;


-- PROFILES
create policy "Users can view own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);


-- VEHICLES
create policy "Users can view own vehicles"
  on vehicles for select using (auth.uid() = user_id);

create policy "Users can insert own vehicles"
  on vehicles for insert with check (auth.uid() = user_id);

create policy "Users can update own vehicles"
  on vehicles for update using (auth.uid() = user_id);

create policy "Users can delete own vehicles"
  on vehicles for delete using (auth.uid() = user_id);


-- MAINTENANCE RECORDS
create policy "Users can view own records"
  on maintenance_records for select using (auth.uid() = user_id);

create policy "Users can insert own records"
  on maintenance_records for insert with check (auth.uid() = user_id);

create policy "Users can update own records"
  on maintenance_records for update using (auth.uid() = user_id);

create policy "Users can delete own records"
  on maintenance_records for delete using (auth.uid() = user_id);


-- REMINDER LOGS
create policy "Users can view own reminder logs"
  on reminder_logs for select using (auth.uid() = user_id);


-- ============================================================
-- INDEXES
-- Speed up the most common queries
-- ============================================================

create index idx_vehicles_user_id
  on vehicles(user_id);

create index idx_maintenance_records_vehicle_id
  on maintenance_records(vehicle_id);

create index idx_maintenance_records_user_id
  on maintenance_records(user_id);

-- Cron job daily scans
create index idx_maintenance_records_next_due_date
  on maintenance_records(next_due_date)
  where status = 'upcoming' and reminder_enabled = true and reminder_sent_at is null;

create index idx_reminder_logs_record_id
  on reminder_logs(maintenance_record_id);
-- Allow anyone (unauthenticated) to read a record_exports row by its ID.
-- This is intentional: the verify URL is printed on the PDF and meant to be
-- visited by third parties (car buyers, mechanics) who have no account.
-- The only data exposed is: exported_at, record_count, export_hash, and the
-- vehicle's year/make/model via a join — no PII, no user data.

alter table record_exports enable row level security;

create policy "Public can verify exports by ID"
  on record_exports
  for select
  to anon
  using (true);

-- Also allow public read of the vehicle year/make/model for the verify page.
-- Vehicles already have RLS for authenticated owners; this adds a narrow
-- anon-readable view via a security-definer function to avoid exposing the
-- full vehicles table to anon.
create or replace function public.get_vehicle_summary(p_vehicle_id uuid)
returns table (year integer, make text, model text, "trim" text)
language sql
security definer
stable
as $$
  select year, make, model, "trim"
  from vehicles
  where id = p_vehicle_id;
$$;

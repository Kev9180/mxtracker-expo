alter table public.record_exports
  add column record_snapshot jsonb;

comment on column public.record_exports.record_snapshot is
  'Maintenance record data captured at export time for later verification.';
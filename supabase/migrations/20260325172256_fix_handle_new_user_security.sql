-- Fix handle_new_user trigger function missing SECURITY DEFINER.
-- Without it the function runs as the signing-up user who has no INSERT
-- permission on profiles (blocked by RLS), causing silent failures.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  insert into profiles (id, reminder_email, display_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'display_name'
  )
  on conflict (id) do nothing;
  return new;
exception
  when others then
    return new;  -- Don't block signup if profile creation fails
end;
$$;

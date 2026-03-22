-- Add push notification support to profiles.
-- push_token: Expo push token, registered on device and saved on login.
-- push_notifications_enabled: master toggle for push (separate from email).

alter table profiles
  add column if not exists push_token text,
  add column if not exists push_notifications_enabled boolean not null default true;

comment on column profiles.push_token is 'Expo push token for this device. Registered on app startup and updated on each login.';
comment on column profiles.push_notifications_enabled is 'Whether to send push notifications for maintenance reminders.';

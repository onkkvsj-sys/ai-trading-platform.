-- Apex Terminal: Supabase starter schema
-- Apply in a new Supabase project after enabling Auth. This does not connect or move money.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null default 'customer' check (role in ('customer','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.topup_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(18,2) not null check (amount > 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  note text not null default '' check (char_length(note) <= 500),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text not null default '' check (char_length(admin_note) <= 1000),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_owner_id uuid not null references auth.users(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 5000),
  attachment_path text,
  attachment_mime text,
  attachment_name text,
  created_at timestamptz not null default now(),
  constraint message_has_content check (
    char_length(trim(body)) > 0 or attachment_path is not null
  )
);

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id),
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.simulated_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_id text not null,
  side text not null check (side in ('buy','sell')),
  notional_usd numeric(18,2) not null check (notional_usd > 0),
  reference_price numeric(24,10) not null check (reference_price > 0),
  execution_mode text not null default 'simulated' check (execution_mode = 'simulated'),
  status text not null default 'recorded' check (status in ('recorded','cancelled')),
  created_at timestamptz not null default now()
);

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$fn$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

create or replace function public.protect_profile_role()
returns trigger language plpgsql security definer set search_path = public, private
as $fn$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not private.is_admin() then
    raise exception 'Only an administrator can change profile roles';
  end if;
  return new;
end;
$fn$;
revoke all on function public.protect_profile_role() from public, anon, authenticated;
drop trigger if exists protect_profile_role_trigger on public.profiles;
create trigger protect_profile_role_trigger before update on public.profiles
for each row execute function public.protect_profile_role();

alter table public.profiles enable row level security;
alter table public.app_settings enable row level security;
alter table public.topup_requests enable row level security;
alter table public.messages enable row level security;
alter table public.activity_events enable row level security;
alter table public.simulated_orders enable row level security;

drop policy if exists "profiles_read_self_or_admin" on public.profiles;
create policy "profiles_read_self_or_admin" on public.profiles
for select to authenticated using (id = auth.uid() or private.is_admin());
drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin" on public.profiles
for update to authenticated using (id = auth.uid() or private.is_admin())
with check (id = auth.uid() or private.is_admin());
-- Role changes must be made by an administrator via trusted server-side code;
-- do not expose role changes through a public profile-edit form.

drop policy if exists "settings_read_authenticated" on public.app_settings;
create policy "settings_read_authenticated" on public.app_settings
for select to authenticated using (true);
drop policy if exists "settings_admin_write" on public.app_settings;
drop policy if exists settings_admin_insert on public.app_settings;
drop policy if exists settings_admin_update on public.app_settings;
drop policy if exists settings_admin_delete on public.app_settings;
create policy settings_admin_insert on public.app_settings for insert to authenticated with check (private.is_admin());
create policy settings_admin_update on public.app_settings for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy settings_admin_delete on public.app_settings for delete to authenticated using (private.is_admin());

create index if not exists app_settings_updated_by_idx on public.app_settings(updated_by);
create index if not exists topup_requests_user_id_idx on public.topup_requests(user_id);
create index if not exists topup_requests_reviewed_by_idx on public.topup_requests(reviewed_by);
create index if not exists messages_conversation_owner_created_idx on public.messages(conversation_owner_id, created_at);
create index if not exists messages_sender_id_idx on public.messages(sender_id);
create index if not exists activity_events_user_created_idx on public.activity_events(user_id, created_at desc);
create index if not exists activity_events_actor_id_idx on public.activity_events(actor_id);
create index if not exists simulated_orders_user_created_idx on public.simulated_orders(user_id, created_at desc);

drop policy if exists "topups_read_owner_or_admin" on public.topup_requests;
create policy "topups_read_owner_or_admin" on public.topup_requests
for select to authenticated using (user_id = auth.uid() or private.is_admin());
drop policy if exists "topups_create_own_pending" on public.topup_requests;
create policy "topups_create_own_pending" on public.topup_requests
for insert to authenticated with check (
  user_id = auth.uid() and status = 'pending' and reviewed_by is null and reviewed_at is null
);
drop policy if exists "topups_admin_review" on public.topup_requests;
create policy "topups_admin_review" on public.topup_requests
for update to authenticated using (private.is_admin()) with check (private.is_admin());

drop policy if exists "messages_read_owner_or_admin" on public.messages;
create policy "messages_read_owner_or_admin" on public.messages
for select to authenticated using (conversation_owner_id = auth.uid() or private.is_admin());
drop policy if exists "messages_insert_as_self" on public.messages;
create policy "messages_insert_as_self" on public.messages
for insert to authenticated with check (
  sender_id = auth.uid() and
  (conversation_owner_id = auth.uid() or private.is_admin())
);
drop policy if exists "messages_admin_delete" on public.messages;
create policy "messages_admin_delete" on public.messages
for delete to authenticated using (private.is_admin());

drop policy if exists "activity_read_owner_or_admin" on public.activity_events;
create policy "activity_read_owner_or_admin" on public.activity_events
for select to authenticated using (user_id = auth.uid() or private.is_admin());
drop policy if exists "activity_insert_self_or_admin" on public.activity_events;
create policy "activity_insert_self_or_admin" on public.activity_events
for insert to authenticated with check ((user_id = auth.uid() and (actor_id is null or actor_id = auth.uid())) or private.is_admin());

drop policy if exists "orders_read_owner_or_admin" on public.simulated_orders;
create policy "orders_read_owner_or_admin" on public.simulated_orders
for select to authenticated using (user_id = auth.uid() or private.is_admin());
drop policy if exists "orders_insert_own_simulated" on public.simulated_orders;
create policy "orders_insert_own_simulated" on public.simulated_orders
for insert to authenticated with check (
  user_id = auth.uid() and execution_mode = 'simulated' and status = 'open'
);

-- Profile bootstrap, order state, and private chat attachment storage.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''), 'customer')
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.app_settings (key, value)
values ('welcome_gift', '{"amount":250,"title":"Apex Welcome Credit","terms":"Promotional preview credit only. Not cash, a deposit, or a withdrawable balance."}'::jsonb)
on conflict (key) do nothing;

alter table public.simulated_orders drop constraint if exists simulated_orders_status_check;
alter table public.simulated_orders add column if not exists realized_pnl numeric(18,2) not null default 0;
alter table public.simulated_orders add column if not exists closed_at timestamptz;
alter table public.simulated_orders add constraint simulated_orders_status_check check (status in ('recorded','cancelled','open','closed'));
drop policy if exists orders_update_own_simulated on public.simulated_orders;
create policy orders_update_own_simulated on public.simulated_orders for update to authenticated
using (user_id = auth.uid() and execution_mode = 'simulated')
with check (user_id = auth.uid() and execution_mode = 'simulated' and status in ('open','closed','cancelled'));
drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles for insert to authenticated
with check (id = auth.uid() and role = 'customer');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-attachments', 'chat-attachments', false, 10485760, array['image/jpeg','image/png','image/webp','image/gif','audio/mpeg','audio/mp4','audio/wav','audio/webm','audio/ogg','audio/aac','audio/x-m4a'])
on conflict (id) do update set public = false, file_size_limit = 10485760;

drop policy if exists chat_files_read_owner_or_admin on storage.objects;
create policy chat_files_read_owner_or_admin on storage.objects for select to authenticated
using (bucket_id = 'chat-attachments' and ((storage.foldername(name))[1] = auth.uid()::text or private.is_admin()));
drop policy if exists chat_files_insert_owner_or_admin on storage.objects;
create policy chat_files_insert_owner_or_admin on storage.objects for insert to authenticated
with check (bucket_id = 'chat-attachments' and ((storage.foldername(name))[1] = auth.uid()::text or private.is_admin()));
drop policy if exists chat_files_update_owner_or_admin on storage.objects;
create policy chat_files_update_owner_or_admin on storage.objects for update to authenticated
using (bucket_id = 'chat-attachments' and ((storage.foldername(name))[1] = auth.uid()::text or private.is_admin()))
with check (bucket_id = 'chat-attachments' and ((storage.foldername(name))[1] = auth.uid()::text or private.is_admin()));
drop policy if exists chat_files_delete_owner_or_admin on storage.objects;
create policy chat_files_delete_owner_or_admin on storage.objects for delete to authenticated
using (bucket_id = 'chat-attachments' and ((storage.foldername(name))[1] = auth.uid()::text or private.is_admin()));

revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;
revoke all on function public.protect_profile_role() from public, anon, authenticated;

-- First administrator: after the owner signs up, run a trusted SQL update for that verified account UUID.
-- update public.profiles set role = 'admin' where id = '<verified-auth-user-uuid>';
-- Do not expose role assignment to browser code or a public signup form.

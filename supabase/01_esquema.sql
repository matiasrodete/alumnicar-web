-- AlumniCar · esquema de la base de datos
-- Pega todo este archivo en Supabase → SQL Editor → New query → Run.
-- Se puede correr más de una vez sin romper nada.

-- ============ Administradores ============
-- Solo las cuentas que estén en esta tabla pueden publicar, editar y borrar.
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
drop policy if exists "cada admin ve su propio registro" on public.admins;
create policy "cada admin ve su propio registro" on public.admins
  for select to authenticated using (user_id = auth.uid());

create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;

-- ============ Coches ============
create table if not exists public.cars (
  ref         text primary key check (ref ~ '^AC-[0-9]{4,}$'),
  make        text not null,
  model       text not null,
  year        int  not null check (year between 1990 and 2100),
  km          int  not null check (km >= 0),
  price       int  not null check (price > 0),
  gear        text not null default 'Automática' check (gear in ('Automática','Estándar')),
  body        text not null default 'Sedán' check (body in ('Hatchback','Sedán','SUV','Pickup')),
  fuel        text not null default 'Gasolina' check (fuel in ('Gasolina','Híbrido','Eléctrico')),
  zone        text not null,
  color       text not null default '#5A6470',
  color_name  text,
  engine      text,
  owners      int  not null default 1,
  plates      text,
  tenencia    text not null default 'Al corriente',
  verif       text not null default 'Vigente',
  grades      text not null default 'AAA' check (grades ~ '^[ABC]{3}$'),   -- carrocería, interior, mecánica
  in_date     date,                                                       -- verificación de entrada
  status      text not null default 'Disponible' check (status in ('Disponible','Apartado','Vendido')),
  description text,
  notes       text[] not null default '{}',                               -- observaciones del mecánico
  photos      text[] not null default '{}',                               -- URLs públicas de las fotos
  demo        boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists cars_touch on public.cars;
create trigger cars_touch before update on public.cars for each row execute function public.touch_updated_at();

alter table public.cars enable row level security;
drop policy if exists "el público ve coches publicados" on public.cars;
create policy "el público ve coches publicados" on public.cars
  for select using (status in ('Disponible','Apartado') or public.is_admin());
drop policy if exists "admins crean coches" on public.cars;
create policy "admins crean coches" on public.cars
  for insert to authenticated with check (public.is_admin());
drop policy if exists "admins editan coches" on public.cars;
create policy "admins editan coches" on public.cars
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins borran coches" on public.cars;
create policy "admins borran coches" on public.cars
  for delete to authenticated using (public.is_admin());

-- ============ Solicitudes del formulario de contacto ============
create table if not exists public.leads (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  intent     text not null check (intent in ('comprar','vender','financiamiento')),
  name       text not null check (char_length(name) between 1 and 120),
  is_uni     boolean,
  university text check (char_length(university) <= 120),
  email      text not null check (char_length(email) between 5 and 200),
  phone      text check (char_length(phone) <= 20),
  car_ref    text check (char_length(car_ref) <= 20),
  message    text check (char_length(message) <= 2000),
  handled    boolean not null default false
);
alter table public.leads enable row level security;
drop policy if exists "cualquiera puede enviar una solicitud" on public.leads;
create policy "cualquiera puede enviar una solicitud" on public.leads
  for insert to anon, authenticated with check (handled = false);
drop policy if exists "admins leen solicitudes" on public.leads;
create policy "admins leen solicitudes" on public.leads
  for select to authenticated using (public.is_admin());
drop policy if exists "admins actualizan solicitudes" on public.leads;
create policy "admins actualizan solicitudes" on public.leads
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins borran solicitudes" on public.leads;
create policy "admins borran solicitudes" on public.leads
  for delete to authenticated using (public.is_admin());

-- ============ Fotos (Storage) ============
-- Carpeta pública "car-photos": cualquiera puede ver las fotos, solo admins suben o borran.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('car-photos', 'car-photos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "admins suben fotos" on storage.objects;
create policy "admins suben fotos" on storage.objects
  for insert to authenticated with check (bucket_id = 'car-photos' and public.is_admin());
drop policy if exists "admins listan fotos" on storage.objects;
create policy "admins listan fotos" on storage.objects
  for select to authenticated using (bucket_id = 'car-photos' and public.is_admin());
drop policy if exists "admins cambian fotos" on storage.objects;
create policy "admins cambian fotos" on storage.objects
  for update to authenticated using (bucket_id = 'car-photos' and public.is_admin());
drop policy if exists "admins borran fotos" on storage.objects;
create policy "admins borran fotos" on storage.objects
  for delete to authenticated using (bucket_id = 'car-photos' and public.is_admin());

-- ==========================================================
-- SCRIPT DE MIGRACIÓN SUPABASE: PERFIL DE USUARIO E HISTORIAL DE PESO
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase.
-- ==========================================================

-- 1. Tabla de Perfiles (si no existe)
create table if not exists perfiles (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  created_at timestamp with time zone default now()
);

-- 2. Tabla de Datos Metabólicos del Perfil
create table if not exists perfil_datos (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references perfiles(id) on delete cascade,
  sexo text not null default 'masculino',
  fecha_nacimiento date default '1995-01-01',
  altura_cm numeric not null default 175,
  nivel_actividad text not null default 'moderado',
  objetivo text not null default 'mantener',
  restricciones text,
  zona_horaria text default 'America/Argentina/Buenos_Aires',
  updated_at timestamp with time zone default now(),
  constraint perfil_datos_perfil_id_key unique (perfil_id)
);

-- 3. Tabla de Registro Histórico de Pesaje
create table if not exists peso_registros (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references perfiles(id) on delete cascade,
  peso_kg numeric not null,
  fecha date not null default current_date,
  nota text,
  created_at timestamp with time zone default now()
);

-- Índices para búsqueda rápida
create index if not exists idx_peso_registros_perfil on peso_registros(perfil_id, fecha desc);

-- 4. Habilitar RLS y políticas públicas para la API anon de Supabase
alter table perfiles enable row level security;
alter table perfil_datos enable row level security;
alter table peso_registros enable row level security;

drop policy if exists "Permitir todo anon en perfiles" on perfiles;
create policy "Permitir todo anon en perfiles" on perfiles for all using (true) with check (true);

drop policy if exists "Permitir todo anon en perfil_datos" on perfil_datos;
create policy "Permitir todo anon en perfil_datos" on perfil_datos for all using (true) with check (true);

drop policy if exists "Permitir todo anon en peso_registros" on peso_registros;
create policy "Permitir todo anon en peso_registros" on peso_registros for all using (true) with check (true);

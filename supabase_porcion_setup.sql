-- Migración compatible para guardar el factor aplicado a cada comida.
-- Los registros existentes reciben 1, equivalente a la porción completa.
alter table comidas
add column if not exists factor_porcion numeric not null default 1
check (factor_porcion > 0 and factor_porcion <= 1);

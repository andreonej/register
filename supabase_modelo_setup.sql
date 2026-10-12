-- Campos nuevos opcionales/aditivos para el esquema de respuesta del análisis.
-- Los registros anteriores reciben cantidad=1; su confianza por ingrediente queda desconocida (NULL).
alter table comida_ingredientes
  add column if not exists cantidad integer not null default 1,
  add column if not exists alias text,
  add column if not exists confianza text;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'comida_ingredientes_cantidad_positiva'
      and conrelid = 'comida_ingredientes'::regclass
  ) then
    alter table comida_ingredientes
      add constraint comida_ingredientes_cantidad_positiva check (cantidad > 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'comida_ingredientes_confianza_valida'
      and conrelid = 'comida_ingredientes'::regclass
  ) then
    alter table comida_ingredientes
      add constraint comida_ingredientes_confianza_valida check (confianza is null or confianza in ('alta', 'media', 'baja'));
  end if;
end $$;

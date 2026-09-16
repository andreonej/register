-- ==========================================================
-- SCRIPT DE MIGRACIÓN SUPABASE: GRUPO NUTRICIONAL EN INGREDIENTES
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase.
-- ==========================================================

-- 1. Agregar columna grupo_nutricional a comida_ingredientes
alter table comida_ingredientes 
add column if not exists grupo_nutricional text;

-- 2. (Opcional) Comentario descriptivo en la columna
comment on column comida_ingredientes.grupo_nutricional is 'Clasificación funcional/nutricional del ingrediente (ej: proteina_animal, vegetal_fibra, carbohidrato_almidon, etc.)';

-- Ejecutar una vez en el SQL Editor de Supabase.
-- La tabla conserva solo la ruta; el archivo vive en Supabase Storage.
alter table comidas add column if not exists foto_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-comidas', 'fotos-comidas', true, 5242880, array['image/jpeg'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Fotos de comidas: acceso anon" on storage.objects;
create policy "Fotos de comidas: acceso anon"
on storage.objects for all to anon
using (bucket_id = 'fotos-comidas')
with check (bucket_id = 'fotos-comidas');

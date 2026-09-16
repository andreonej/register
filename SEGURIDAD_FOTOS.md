# Fotos de comidas: recordatorio de seguridad

## Estado actual

La app guarda las fotos en el bucket público de Supabase Storage `fotos-comidas`.
Esto es aceptable por ahora porque la aplicación es personal y solo la usa su creador.

La tabla `comidas` solo almacena `foto_path`; el archivo está en Storage y se muestra
únicamente cuando se despliega el registro de esa comida.

## Antes de abrir la app a otras personas

No publicar la app para varios usuarios con la configuración actual. Hay que:

1. Implementar Supabase Auth.
2. Convertir el bucket `fotos-comidas` en privado.
3. Reemplazar la URL pública por URLs firmadas de duración limitada.
4. Crear políticas RLS para que cada usuario solo pueda leer, crear y borrar sus propias comidas y fotos.
5. Usar rutas de archivo vinculadas al usuario autenticado, por ejemplo: `<auth.uid()>/<comidaId>.jpg`.
6. Revisar las políticas actuales de las tablas `comidas`, perfiles e ingredientes: no deben permitir acceso anónimo global.

## Archivos relacionados

- `supabase_imagenes_setup.sql`: crea el bucket y el campo `foto_path`.
- `src/services/fotos.js`: sube, elimina y construye las URLs de fotos.
- `src/components/MealRow.jsx`: solicita la foto solo al expandir una comida.

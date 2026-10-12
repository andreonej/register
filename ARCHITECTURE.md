# Mapa del proyecto

## Stack y ejecución

- React 19 y Vite 8; aplicación de una sola página, sin router.
- `src/main.jsx` monta `src/App.jsx`; estilos globales y de pantalla en `src/index.css` y `src/App.css`.
- `npm run dev` inicia el servidor local; `npm run build` genera `dist/`.
- Supabase y el modelo de análisis se configuran mediante variables `VITE_*` (ver `.env.example`). Los servicios hacen llamadas `fetch` desde el navegador.

## Carpetas y responsabilidades

- `src/App.jsx`: estado y navegación principal (Hoy, Progreso, historial y perfil), carga de comidas/perfil, totales del día y guardado/eliminación.
- `src/components/`: interfaz. `AnalyticsPanel.jsx` presenta Progreso; `NewMealDrawer.jsx` reúne carga por foto, texto y formato estructurado; `MealRow.jsx` muestra cada registro; `MacroBar.jsx` dibuja los anillos; `ProfileView.jsx` contiene perfil, peso y selección del modelo.
- `src/lib/`: lógica local. `progresoIntelligence.js` agrupa los últimos siete días y calcula métricas, estados, sugerencias e insights; `date.js` normaliza y agrupa fechas; `metabolismo.js` calcula metas nutricionales.
- `src/services/`: acceso a datos y servicios externos. `comidas.js` consulta/crea/elimina comidas e ingredientes en Supabase; `gemini.js` analiza fotos y texto y persiste la selección de modelo en almacenamiento local; `fotos.js` sube/elimina imágenes; `perfil.js` gestiona perfil y pesos.

## Flujos y datos

1. `App.jsx` llama a `obtenerComidas()` y `obtenerPerfilActivo()` al iniciar. Los totales de Hoy se suman desde `comidas_del_dia` en memoria.
2. El botón `+` abre `NewMealDrawer`. Este procesa la imagen, invoca `analizarFotoComida()` o `analizarTextoComida()` en `services/gemini.js` y ofrece guardar el resultado mediante `guardarRegistro()` → `crearComida()`.
3. Progreso recibe comidas, objetivos y perfil en `AnalyticsPanel.jsx`; sus cálculos vienen de `analizarProgreso()` en `lib/progresoIntelligence.js`.

## Persistencia conocida por el código

- Supabase REST: tabla `comidas`, relacionada con `comida_ingredientes`; la consulta carga `comidas` con `comida_ingredientes(*)`. El código de comidas usa `comidas.id`, `comida_nombre`, `fecha`, `calorias_totales`, `proteinas_totales_g`, `carbohidratos_totales_g`, `grasas_totales_g`, `nivel_confianza`, `perfil_id` y `foto_path`. Ingredientes: `comida_id`, `nombre`, `peso_estimado_g`, `calorias`, macros, `supuesto` y `grupo_nutricional`.
- Perfil: `perfiles`, `perfil_datos` y `peso_registros`; la estructura de perfil se crea en `supabase_perfil_setup.sql`.
- La aplicación espera además un bucket `fotos-comidas`; `supabase_imagenes_setup.sql` agrega `foto_path` y configura el bucket. `supabase_grupo_nutricional_setup.sql` agrega `grupo_nutricional`.
- No hay en este repositorio un SQL de creación inicial para `comidas`/`comida_ingredientes`; los campos anteriores describen el contrato que usa el cliente, no verifican el esquema desplegado.

## Límites actuales relevantes para las etapas

- La selección de modelo está almacenada en el navegador y se expone desde el perfil.
- El cajón de carga actualmente tiene pestañas Foto, texto y formato estructurado; el resultado y sus controles viven en `NewMealDrawer.jsx`.
- No existe una suite de pruebas automatizadas identificada en `package.json`.

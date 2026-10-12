# Estado de implementación v2

## Etapa actual

Etapa 0 — Mapa del proyecto.

## Hecho

- Documentado el stack, carpetas, flujos de datos, puntos de cálculo y contrato de persistencia conocido en `ARCHITECTURE.md`.
- No se modificó código de la aplicación.

## Decisiones

- El esquema de comidas se documenta como contrato observado en el cliente: el repositorio no contiene el SQL de creación inicial de esas tablas.
- El perfil del modelo está en `ProfileView.jsx`; el cajón de carga está implementado en `NewMealDrawer.jsx`.

## Archivos tocados

- `ARCHITECTURE.md` (nuevo).
- `STATE.md` (nuevo).

## Pendientes / siguiente paso exacto

- Prueba de etapa 0 completada: `npm run build` terminó correctamente; `npm run dev -- --host 127.0.0.1` inició Vite y la ruta `/` respondió HTTP 200. No se abrió una sesión de navegador para revisar la pantalla visualmente.
- Etapa 0 lista. Tras guardar esta etapa, comenzar etapa 1: cálculos de Progreso (excluir hoy de métricas, derivar etiquetas de reglas y corregir estados/colores del gráfico), limitada a las secciones 2.1, 2.2 y 2.3 de la especificación.
- Pendiente de aclarar en otra sesión: obtener o agregar el SQL de creación inicial de `comidas` y `comida_ingredientes` para documentar su esquema desplegado completo.

## Cómo probar esta etapa

1. `npm run build` — correcto.
2. `npm run dev -- --host 127.0.0.1` — Vite inició y `GET /` respondió HTTP 200.

# Estado de implementación v2

## Etapa actual

Etapa 1 — Cálculos de Progreso, completada.

## Hecho

- Etapa 0: documentado el stack, carpetas, flujos de datos, puntos de cálculo y contrato de persistencia conocido en `ARCHITECTURE.md`.
- Etapa 1: los promedios, desviaciones, días en rango y comparativas excluyen el día en curso. El gráfico lo conserva como día en curso.
- Los días registrados cuentan solo días completos con comidas, sobre el total de días completos de la ventana.
- La estabilidad energética deriva su etiqueta del porcentaje de días en rango: Estable (≥ 0,7), Variable (≥ 0,4) o Irregular (< 0,4).
- La comparación de fin de semana requiere al menos dos días completos registrados de fin de semana y un día de semana registrado; si faltan, muestra “Aún sin datos suficientes”. El texto compara los promedios reales sin juicios fijos.
- El gráfico usa verde para en banda, azul grisáceo para por debajo y naranja para por encima. Proteína, carbohidratos y grasas mantienen colores propios en anillos y barras.

## Decisiones

- No se consultó ni modificó Supabase: esta etapa solo usa los datos que la app ya carga.
- Se agregó `fechaReferencia` opcional a `analizarProgreso` para poder verificar ventanas históricas de forma reproducible; en la app se usa la fecha actual.

## Archivos tocados

- `ARCHITECTURE.md` (nuevo).
- `STATE.md` (nuevo).
- `src/lib/progresoIntelligence.js`.
- `src/components/AnalyticsPanel.jsx`.
- `src/components/MacroBar.jsx`.
- `src/App.jsx`.
- `src/App.css`.

## Pendientes / siguiente paso exacto

- Verificación etapa 1: `npm run build` correcto y servidor Vite responde HTTP 200. Caso controlado con domingo 11 en curso (355 kcal), seis días anteriores registrados y solo sábado como día de fin de semana completo: promedio 1167 kcal sin incluir las 355 kcal de hoy, estabilidad `1 / 6 · Irregular` y comparativa marcada insuficiente. No se revisó la pantalla en un navegador ni se consultaron datos reales de Supabase.
- Etapa 1 lista. Siguiente: etapa 2 — resultado del análisis y textos; leer solo las secciones 3.2, 3.4, 3.3b y 4.2 de la especificación.
- Pendiente de aclarar en otra sesión: obtener o agregar el SQL de creación inicial de `comidas` y `comida_ingredientes` para documentar su esquema desplegado completo.

## Cómo probar esta etapa

1. Abrir Progreso y confirmar que el día actual aparece en el gráfico como “En curso”.
2. Revisar que el promedio y los días registrados incluyan solo días completos.
3. Con menos de dos días de fin de semana completos, confirmar “Aún sin datos suficientes”.
4. Comparar los colores de los macros en Hoy y Progreso.
5. Confirmación técnica realizada: `npm run build` correcto; `GET /` local respondió HTTP 200; cálculo contrastado con fixture determinístico.

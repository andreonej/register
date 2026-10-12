# Estado de implementación v2

## Etapa actual

Etapa 2 — Pantalla de resultado y textos; implementación lista, validación manual pendiente.

## Hecho

- Etapa 0: documentado el stack, carpetas, flujos de datos, puntos de cálculo y contrato de persistencia conocido en `ARCHITECTURE.md`.
- Etapa 1: los promedios, desviaciones, días en rango y comparativas excluyen el día en curso. El gráfico lo conserva como día en curso.
- Los días registrados cuentan solo días completos con comidas, sobre el total de días completos de la ventana.
- La estabilidad energética deriva su etiqueta del porcentaje de días en rango: Estable (≥ 0,7), Variable (≥ 0,4) o Irregular (< 0,4).
- La comparación de fin de semana requiere al menos dos días completos registrados de fin de semana y un día de semana registrado; si faltan, muestra “Aún sin datos suficientes”. El texto compara los promedios reales sin juicios fijos.
- El gráfico usa verde para en banda, azul grisáceo para por debajo y naranja para por encima. Proteína, carbohidratos y grasas mantienen colores propios en anillos y barras.
- Etapa 2: el selector de modelo está dentro de “Ajustes avanzados”; se quitó del modal y los textos de análisis no exponen el proveedor.
- El resultado por foto y texto muestra título, confianza legible, totales, ingredientes y acciones; la foto se ve completa en una miniatura ampliable.
- Los controles de corrección quedan colapsados tras el análisis. “Volver a analizar” se deshabilita cuando no hay correcciones para enviar.
- Al guardar, la app vuelve al día de la comida, desplaza hasta el registro y muestra “+N kcal añadidas” con “Deshacer” durante cuatro segundos.

## Decisiones

- No se consultó ni modificó Supabase: esta etapa solo usa los datos que la app ya carga.
- Se agregó `fechaReferencia` opcional a `analizarProgreso` para poder verificar ventanas históricas de forma reproducible; en la app se usa la fecha actual.
- No se modificó el esquema ni se insertaron datos de prueba en Supabase. El editor heredado sigue detrás del botón “Editar ingredientes” como transición; la etapa 3 lo reemplaza por edición estructurada.

## Archivos tocados

- `ARCHITECTURE.md` (nuevo).
- `STATE.md` (nuevo).
- `src/lib/progresoIntelligence.js`.
- `src/components/AnalyticsPanel.jsx`.
- `src/components/MacroBar.jsx`.
- `src/App.jsx`.
- `src/App.css`.
- `src/components/NewMealDrawer.jsx`.
- `src/components/ProfileView.jsx`.
- `src/components/MealRow.jsx`.

## Pendientes / siguiente paso exacto

- Verificación etapa 1: `npm run build` correcto y servidor Vite responde HTTP 200. Caso controlado con domingo 11 en curso (355 kcal), seis días anteriores registrados y solo sábado como día de fin de semana completo: promedio 1167 kcal sin incluir las 355 kcal de hoy, estabilidad `1 / 6 · Irregular` y comparativa marcada insuficiente.
- Verificación técnica etapa 2: `npm run build` correcto; servidor Vite responde HTTP 200. No hay navegador disponible en este entorno y no se insertaron registros de prueba en Supabase, por lo que falta validar visualmente el orden, la barra fija y el flujo guardar/deshacer.
- Siguiente paso exacto: probar manualmente los cinco pasos de “Cómo probar la etapa actual”. Si pasan, marcar etapa 2 completa y recién entonces comenzar etapa 3 — porción e ingredientes editables; leer solo las secciones 3.1 y 3.3 de la especificación.
- Pendiente de aclarar en otra sesión: obtener o agregar el SQL de creación inicial de `comidas` y `comida_ingredientes` para documentar su esquema desplegado completo.

## Cómo probar la etapa actual

1. Analizar una foto y confirmar el orden: miniatura completa, título/confianza, totales, ingredientes y acciones.
2. Tocar la miniatura para ampliarla; abrir “¿Corregir algo?” y comprobar que “Volver a analizar” solo se activa con una corrección.
3. Guardar una comida: confirmar regreso al día correspondiente, desplazamiento al registro y aviso durante cuatro segundos. Pulsar “Deshacer” y comprobar que desaparece.
4. Abrir Perfil → Ajustes avanzados y comprobar que el modelo se cambia desde allí, no desde el modal.
5. Confirmación técnica realizada: `npm run build` correcto y `GET /` local respondió HTTP 200. Falta confirmar los pasos visuales y el guardado/deshacer desde un navegador.

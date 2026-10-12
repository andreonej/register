# Estado de implementación v2

## Etapa actual

Etapa 3 — Porción e ingredientes editables; implementación lista, migración de Supabase y validación manual pendientes.

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
- Etapa 3: selector Todo/Mitad/1/3/Personalizado escala localmente gramos, calorías y macros, sin repetir el análisis del modelo.
- Etapa 3: los ingredientes se pueden editar, agregar o quitar; los gramos recalculan proporcionalmente kcal/macros y los totales.
- El editor JSON estructurado queda dentro de Perfil → Ajustes avanzados → Modo de depuración.
- El guardado incluye `factor_porcion`; `supabase_porcion_setup.sql` agrega la columna con valor predeterminado 1 para comidas existentes.

## Decisiones

- Se consultó Supabase solo mediante REST de lectura para verificar `factor_porcion`; la columna no existe todavía. No se insertaron ni modificaron registros.
- Se agregó `fechaReferencia` opcional a `analizarProgreso` para poder verificar ventanas históricas de forma reproducible; en la app se usa la fecha actual.
- La migración SQL está preparada, pero debe ejecutarse en el SQL Editor de Supabase antes de guardar comidas desde esta versión.

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
- `src/lib/registroEjemplo.js`.
- `supabase_porcion_setup.sql`.

## Pendientes / siguiente paso exacto

- Verificación etapa 1: `npm run build` correcto y servidor Vite responde HTTP 200. Caso controlado con domingo 11 en curso (355 kcal), seis días anteriores registrados y solo sábado como día de fin de semana completo: promedio 1167 kcal sin incluir las 355 kcal de hoy, estabilidad `1 / 6 · Irregular` y comparativa marcada insuficiente.
- Verificación técnica etapa 2: `npm run build` correcto; servidor Vite responde HTTP 200. El usuario confirmó que funcionó perfectamente.
- Verificación técnica etapa 3: `npm run build` correcto; caso determinista confirmó que Mitad escala ingredientes/macros y editar gramos recalcula kcal y totales. La consulta REST de solo lectura falló al solicitar `factor_porcion`, señal de que falta aplicar la migración.
- Siguiente paso exacto: ejecutar `supabase_porcion_setup.sql` en Supabase y probar manualmente la etapa 3: escalar porción, cambiar gramos, agregar/quitar ingredientes, guardar y abrir una comida previa.
- Pendiente de aclarar en otra sesión: obtener o agregar el SQL de creación inicial de `comidas` y `comida_ingredientes` para documentar su esquema desplegado completo.

## Cómo probar la etapa actual (tras aplicar la migración)

1. Ejecutar `supabase_porcion_setup.sql` en el SQL Editor del proyecto Supabase.
2. Analizar una foto y probar Todo, Mitad y 1/3; comprobar que los valores cambian sin volver a analizar.
3. Elegir Personalizado, modificar gramos, agregar un ingrediente y quitar uno; confirmar que los totales se actualizan.
4. Guardar y comprobar en el registro que se conserva la comida; abrir una comida previa y confirmar que sigue mostrando porción completa.
5. Abrir Perfil → Ajustes avanzados → Modo de depuración para confirmar que el editor estructurado ya no aparece en el flujo normal.

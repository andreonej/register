# Estado de implementación v2

## Etapa actual

Etapa 4 — Esquema del análisis; en curso (confianza, agrupación y sugerencias contextuales).

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
- Etapa 3 validada manualmente por el usuario; confirmó que los cambios y correcciones funcionaron.
- Se redondean valores de porción a dos decimales y las claves estables del editor conservan el foco al escribir (commit `441bf71`).

## Decisiones

- Se consultó Supabase solo mediante REST de lectura para verificar `factor_porcion`; en ese momento la columna no existía. El usuario confirmó después que la etapa 3 funcionó, por lo que la migración necesaria quedó aplicada.
- Se agregó `fechaReferencia` opcional a `analizarProgreso` para poder verificar ventanas históricas de forma reproducible; en la app se usa la fecha actual.
- La fase 4 agrega cantidad y confianza por ingrediente con migración aditiva y valores compatibles para comidas existentes.

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
- Siguiente paso exacto: ampliar los prompts y la normalización de respuesta, mostrar confianza/cantidad/sugerencias contextuales y persistir los nuevos campos sin afectar registros antiguos.
- Pendiente de aclarar en otra sesión: obtener o agregar el SQL de creación inicial de `comidas` y `comida_ingredientes` para documentar su esquema desplegado completo.

## Cómo probar la etapa actual

1. Analizar tres platos distintos; verificar confianza general y por ingrediente, y que nombres repetidos se agrupen con cantidad.
2. Confirmar que los chips sugeridos corresponden al plato; usar uno y volver a analizar.
3. Guardar y volver a abrir registros nuevos y antiguos para confirmar compatibilidad.

# Estado de implementación v2

## Etapa actual

Etapa 8 — Progreso y cierre de brecha; implementación en curso, validación manual pendiente.

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
- Etapa 4: el análisis solicita confianza general y por ingrediente, alias opcional, cantidad agrupada y hasta seis correcciones contextuales.
- Las respuestas antiguas se completan con defaults; nombres idénticos se consolidan, nombres con barra se normalizan y su alternativa pasa a alias.
- La pantalla muestra advertencia para ingredientes de confianza baja, permite ajustar cantidad con recálculo proporcional y conserva cantidad al guardar/abrir.
- Los chips de corrección salen de las sugerencias del análisis, no de una lista genérica de preparación.
- La confianza general usa el campo ya existente `nivel_confianza`; `supabase_modelo_setup.sql` agrega cantidad, alias y confianza por ingrediente de forma aditiva.
- Etapa 4 validada manualmente por el usuario; confirmó que las pruebas salieron bien. La consulta REST de solo lectura confirma que los campos nuevos están presentes en Supabase.
- Etapa 5: el prompt prioriza la descripción y cantidades del usuario, no pregunta de vuelta y marca cada ingrediente como indicado o estimado; el resultado distingue ambos orígenes.
- El modo Describir incluye Ahora, Hace 1 h, Esta mañana, Mediodía, Anoche y fecha/hora elegible. La fecha local elegida se fuerza en la respuesta y se persiste con la comida.
- El botón Analizar queda sticky en la vista de escritura; el cajón sigue el viewport visible/teclado. El campo conserva textarea nativo para dictado y usa tipografía de la app.
- El flujo normal ofrece solo Foto y Describir; no hay pestaña Manual. Los ingredientes inferidos se conservan usando el indicador de supuesto existente, sin cambio de esquema.
- Etapa 5 validada manualmente por el usuario; confirmó que las pruebas salieron bien.
- Etapa 6: el botón + abre un menú corto con Cámara, Galería, Describir y Repetir reciente.
- Cámara inicia captura directamente y comienza el análisis al recibir la foto; durante el análisis se ve la imagen, el progreso y la acción Cancelar (solicitud abortable).
- La pestaña Describir reemplaza ejemplos genéricos por hasta cuatro comidas reales agrupadas por nombre y franja horaria, ordenadas por frecuencia y franja actual.
- Tocar una comida frecuente la registra directamente desde los datos cargados, sin llamar al modelo; “Ajustar porción” permite elegir fracción antes de registrar. Repetir reciente clona la última comida como un registro nuevo.
- La foto usa un icono de cámara de línea. No se requiere un cambio de esquema.
- Etapa 6 validada manualmente por el usuario; confirmó que las pruebas funcionaron bien.
- Etapa 7: los anillos de macros muestran consumido/meta y señalan el exceso; calorías mantiene una sola representación principal.
- Etapa 7: los días muestran estado nutricional, las comidas se agrupan por franja con subtotales y muestran miniatura, título de hasta dos líneas y macros con mayor contraste.
- Etapa 7: el calendario mensual permite navegar por días y conserva acceso independiente al historial completo desde Progreso.
- Etapa 7: el detalle permite corregir valores de ingredientes; el borrado tiene una ventana de cinco segundos para deshacer. El cierre de brecha se muestra en Hoy cuando falta al menos 15 % de la meta de proteína.
- Etapa 7 validada manualmente por el usuario; confirmó que todo funciona.

## Decisiones

- Se consultó Supabase solo mediante REST de lectura para verificar columnas de porción y esquema del análisis. No se insertaron datos ni se modificó la base.
- No se requiere migración nueva para la etapa 5: se reutilizan `fecha` y `supuesto` existentes.
- Los atajos se calculan desde las últimas comidas que la app ya carga (hasta 200); no hay consultas ni llamadas adicionales para calcularlos.
- Los registros rápidos guardan una nueva comida con hora actual, ingredientes y macros copiados/escalados; no copian el `id` ni la foto del registro original.
- Se agregó `fechaReferencia` opcional a `analizarProgreso` para poder verificar ventanas históricas de forma reproducible; en la app se usa la fecha actual.
- La migración de fase 4 establece cantidad 1 para ingredientes antiguos, confianza NULL y alias NULL; el usuario confirmó que ya la ejecutó y probó la fase.
- Se confirmó que la interfaz de progreso en la etapa 8 usará el historial cargado y no requiere migraciones.

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
- `supabase_modelo_setup.sql`.
- `src/services/gemini.js`.
- `src/services/comidas.js`.
- `src/App.jsx`.

## Pendientes / siguiente paso exacto

- Verificación etapa 1: `npm run build` correcto y servidor Vite responde HTTP 200. Caso controlado con domingo 11 en curso (355 kcal), seis días anteriores registrados y solo sábado como día de fin de semana completo: promedio 1167 kcal sin incluir las 355 kcal de hoy, estabilidad `1 / 6 · Irregular` y comparativa marcada insuficiente.
- Verificación técnica etapa 2: `npm run build` correcto; servidor Vite responde HTTP 200. El usuario confirmó que funcionó perfectamente.
- Verificación técnica etapa 3: `npm run build` correcto y prueba manual confirmada por el usuario. Consulta REST posterior confirmó que `factor_porcion` existe en Supabase.
- Verificación técnica etapa 4: `npm run build` y `git diff --check` correctos. REST confirmó presentes `cantidad`, `alias` y `confianza`; pruebas manuales confirmadas por el usuario.
- Verificación técnica etapa 5: `npm run build` y `git diff --check` correctos; el usuario confirmó validación manual exitosa.
- Verificación técnica etapa 6: `npm run build` correcto; validación manual confirmada por el usuario.
- Verificación técnica etapa 7: `npm run build` y `git diff --check` correctos; HTTP 200. Validación manual confirmada por el usuario.
- Etapa 8 en curso: reorganizar Progreso, agregar selector Semana/Mes con tooltip completo, filtros del ADN alimentario y sugerencias de cierre de brecha limitadas por kcal y macros restantes.
- Siguiente paso exacto: validar ambas ventanas del gráfico, tooltip al tocar barras, filtro de categorías y sugerencias compatibles con los límites nutricionales.
- Pendiente de aclarar en otra sesión: obtener o agregar el SQL de creación inicial de `comidas` y `comida_ingredientes` para documentar su esquema desplegado completo.

## Cómo probar la etapa anterior

1. Pulsar + y confirmar que aparecen Cámara, Galería, Describir y Repetir reciente.
2. Seleccionar Cámara, tomar una foto y confirmar que el análisis empieza sin otro toque; probar también Cancelar durante el progreso.
3. Abrir Describir y verificar que los atajos corresponden a comidas del historial, ordenados por frecuencia/franja.
4. Tocar un atajo frecuente y confirmar que guarda una comida nueva al instante sin petición al modelo; repetir con Ajustar porción.
5. Elegir Repetir reciente y confirmar que crea otro registro nuevo sin análisis.

## Cómo probar la etapa anterior

1. Revisar que cada anillo muestre consumido/meta, calendario y agrupación de comidas.
2. Confirmar que editar valores se guarda y que el borrado se puede deshacer.

## Cómo probar la etapa actual

1. Cambiar entre Semana y Mes y tocar barras para ver fecha, kcal y diferencia vs. meta.
2. Revisar el ADN alimentario y filtrar sus categorías.
3. Verificar que cada sugerencia de cierre de brecha tenga cantidad, proteína y kcal, y respete calorías, grasas y macros restantes.

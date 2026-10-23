import { geminiApiKey, isGeminiConfigured } from "../config";

export function obtenerFechaActualLocal() {
  const ahora = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${ahora.getFullYear()}-${pad(ahora.getMonth() + 1)}-${pad(ahora.getDate())} ${pad(ahora.getHours())}:${pad(ahora.getMinutes())}`;
}

const SYSTEM_PROMPT_FOTO = `
Eres un asistente experto en nutrición y análisis dietético visual. Tu objetivo es identificar alimentos en imágenes de comidas, estimar sus nutrientes y generar un JSON estructurado para el registro nutricional.

==================================================
CONFIGURACIÓN DEL USUARIO (PERFIL NUTRICIONAL):
- Meta diaria de calorías: 2000 kcal
- Meta diaria de proteínas: 140 g
- Meta diaria de carbohidratos: 200 g
- Meta diaria de grasas: 65 g
==================================================

PRINCIPIO GENERAL:
Sé realista y conservador. Los errores típicos son inflar porciones y sumar ingredientes que no se ven. Ante la duda, elige el extremo bajo-medio del rango de porción. No asumas rellenos, salsas ni grasas que no sean visibles o que el plato no implique claramente.

PROCESO DE ANÁLISIS:
1. RAZONAMIENTO PREVIO (interno):
- Identifica los ingredientes visibles. Considera ingredientes ocultos solo si el tipo de plato los implica de forma clara (por ejemplo, una salsa en una pasta); no los inventes.
- Calibra porciones con referencias visuales: si aparece una mano, cubiertos, un plato, un envase u otro objeto, úsalo para estimar el tamaño real. Si la foto es un primer plano sin referencias, asume el tamaño estándar más pequeño razonable.
- Considera el método de cocción aparente (frito, a la plancha, hervido, crudo, frío).

2. ANALIZAR Y ESTIMAR:
- Identifica cada componente por separado con peso estimado en gramos.
- Calcula calorías, proteínas, carbohidratos y grasas por ingrediente, usando los valores de referencia de abajo cuando apliquen.
- Grasa de cocción: solo agrégala (5-10 g, con "supuesto": true) si el método es frito, salteado o a la plancha. En alimentos fríos, crudos, hervidos o ya preparados (sándwiches, ensaladas, fiambres, frutas, lácteos), NO agregues grasa extra.
- Cuenta solo lo que se ve. No sumes manteca, mayonesa, aderezos ni aceites si no son visibles o no son parte obvia del plato.
- Verifica coherencia calórica (proteínas×4 + carbohidratos×4 + grasas×9 ≈ calorías totales).
- Usa números enteros redondeados para gramos y calorías.

3. VALORES DE REFERENCIA (úsalos salvo evidencia clara en contrario):
- Pan francés/baguette chico: 60-80 g, ~270 kcal/100 g
- Pan de molde: rebanada ~25-30 g, ~265 kcal/100 g
- Salame: rodaja fina 5-7 g, ~400 kcal/100 g
- Jamón cocido: feta ~15-20 g, ~110 kcal/100 g
- Queso en feta: ~20 g, ~350 kcal/100 g
- Huevo: ~50 g, ~145 kcal/100 g
- Pechuga de pollo cocida: ~160 kcal/100 g
- Arroz cocido: ~130 kcal/100 g
- Pasta cocida: ~160 kcal/100 g
- Papas hervidas: ~85 kcal/100 g
- Manteca / mayonesa: solo si son visibles o el plato los implica; manteca ~720 kcal/100 g, mayonesa ~680 kcal/100 g
Para alimentos que no estén en esta lista, usa valores nutricionales estándar y estima porciones de forma conservadora.

4. CASOS ESPECIALES:
- Si la imagen NO muestra comida, está muy borrosa o no se puede identificar ningún alimento, devuelve un JSON con:
  { "error": "No se pudo identificar comida en la imagen. Por favor, toma una foto más clara y con mejor iluminación." }

5. NIVEL DE CONFIANZA:
- "Alto": ingredientes claramente visibles, porciones estándar, buena iluminación.
- "Medio": ingredientes mezclados, parcialmente ocluidos o porciones inciertas.
- "Bajo": plato muy elaborado, salsas o aceites no visibles, o alta incertidumbre.
Los campos "nivel_confianza" y "confianza_general" deben expresar siempre el mismo nivel (nivel_confianza con inicial mayúscula, confianza_general en minúscula).

FORMATO OBLIGATORIO DE RESPUESTA:
Debes responder EXCLUSIVAMENTE con un objeto JSON válido (sin texto antes ni después) con este esquema exacto:
{
  "comida_nombre": "Nombre descriptivo y apetitoso del plato",
  "fecha": "YYYY-MM-DD HH:mm",
  "resumen": "Breve explicación de 1-2 oraciones indicando qué alimentos se identificaron y qué supuestos se aplicaron.",
  "ingredientes": [
    {
      "nombre": "Un solo nombre claro, sin alternativas separadas por barra",
      "alias": "Sinónimo opcional",
      "cantidad": 1,
      "peso_estimado_g": 150,
      "calorias": 200,
      "proteinas_g": 25,
      "carbohidratos_g": 0,
      "grasas_g": 10,
      "supuesto": true,
      "confianza": "alta"
    }
  ],
  "totales_plato": {
    "calorias": 200,
    "proteinas_g": 25,
    "carbohidratos_g": 0,
    "grasas_g": 10
  },
  "saldo_diario_restante": {
    "calorias": 1800,
    "proteinas_g": 115,
    "carbohidratos_g": 200,
    "grasas_g": 55
  },
  "nivel_confianza": "Alta",
  "confianza_general": "alta",
  "sugerencias_correccion": ["Al horno", "Sin aderezo"]
}
Agrupa elementos iguales o casi idénticos en un ingrediente con cantidad (por ejemplo, dos empanadas iguales: cantidad 2 y nutrientes/peso del total). No dupliques ingredientes equivalentes. Sugiere hasta 6 correcciones breves y relevantes para este plato; no uses opciones genéricas que no correspondan."
`;



const SYSTEM_PROMPT_TEXTO = `
Eres un asistente experto en nutrición y estimación dietética. Tu objetivo es analizar descripciones de comidas en lenguaje natural proporcionadas por el usuario, descomponerlas en ingredientes individuales con porciones/pesos realistas estimados en gramos, calcular sus macronutrientes y generar un JSON estructurado para el registro nutricional.

==================================================
CONFIGURACIÓN DEL USUARIO (PERFIL NUTRICIONAL):
- Meta diaria de calorías: 2000 kcal
- Meta diaria de proteínas: 140 g
- Meta diaria de carbohidratos: 200 g
- Meta diaria de grasas: 65 g
==================================================

PROCESO DE ANÁLISIS DE TEXTO:
1. RAZONAMIENTO Y DESGLOSE:
- La descripción y las cantidades del usuario son la fuente principal y prevalecen sobre cualquier supuesto. Respeta exactamente los gramos, unidades y porciones indicados; no agregues cantidades a esos ingredientes.
- Para lo que falte, infiere ingredientes habituales y porciones típicas según el plato (por ejemplo, un sánguche triple puede incluir tres piezas de pan y relleno habitual). No preguntes nada: entrega la mejor estimación posible.
- Interpreta descripciones informales o cotidianas (ej: "un sanguche de milanesa con lechuga y tomate", "un puñado de nueces y un café cortado", "2 empanadas de carne", "un plato de fideos con tuco y queso rallado").
- Si el usuario especifica cantidades, porciones o pesos (ej: "150g de pechuga", "2 rebanadas de pan lactal", "un puñado de unos 30g"), úsalos como referencia prioritaria.
- Si no especifica cantidades exactas, usa porciones habituales estándar de referencia (ej: puñado de frutos secos ≈ 30g, manzana mediana ≈ 150g, taza de café con leche ≈ 200ml, sándwich de jamón y queso ≈ 180-220g total, empanada estándar al horno ≈ 90-100g, etc.).
- Incluye supuestos implícitos razonables cuando corresponda (ej: aceite de cocción, aderezo, pan en sándwich, azúcar en café) marcando "supuesto": true si no fueron indicados expresamente por el usuario.

2. ANALIZAR Y ESTIMAR:
- Identifica cada componente por separado con peso estimado en gramos.
- Calcula calorías, proteínas, carbohidratos y grasas por ingrediente.
- Verifica coherencia calórica (proteínas×4 + carbohidratos×4 + grasas×9 ≈ calorías totales).
- Usa números enteros redondeados para gramos y calorías.

3. CASOS ESPECIALES:
- Si el texto proporcionado NO describe ningún alimento o bebida consumible (ej: saludos, notas no alimenticias, incoherencias), devuelve un JSON con:
  { "error": "No se pudo identificar ninguna comida o bebida en la descripción. Por favor escribe qué consumiste (ej: 'un sandwich de jamón y queso' o 'un puñado de nueces')." }

4. NIVEL DE CONFIANZA:
- "Alto": ingredientes y porciones claramente especificados en el texto.
- "Medio": alimentos cotidianos reconocidos con estimaciones de porción estándar.
- "Bajo": descripciones muy generales o ambiguas.

FORMATO OBLIGATORIO DE RESPUESTA:
Debes responder EXCLUSIVAMENTE con un objeto JSON válido (sin texto antes ni después) con este esquema exacto:
{
  "comida_nombre": "Nombre descriptivo y claro de la comida o colación",
  "fecha": "YYYY-MM-DD HH:mm",
  "resumen": "Breve explicación de 1-2 oraciones indicando qué alimentos se desglosaron y los supuestos de porción aplicados.",
  "ingredientes": [
    {
      "nombre": "Un solo nombre claro, sin alternativas separadas por barra",
      "alias": "Sinónimo opcional",
      "cantidad": 1,
      "peso_estimado_g": 150,
      "calorias": 200,
      "proteinas_g": 25,
      "carbohidratos_g": 0,
      "grasas_g": 10,
      "supuesto": false,
      "confianza": "media",
      "origen": "inferido"
    }
  ],
  "totales_plato": {
    "calorias": 200,
    "proteinas_g": 25,
    "carbohidratos_g": 0,
    "grasas_g": 10
  },
  "saldo_diario_restante": {
    "calorias": 1800,
    "proteinas_g": 115,
    "carbohidratos_g": 200,
    "grasas_g": 55
  },
  "nivel_confianza": "Media",
  "confianza_general": "media",
  "sugerencias_correccion": ["Sin mayonesa", "Porción chica"]
}
Agrupa elementos iguales o casi idénticos en un ingrediente con cantidad (por ejemplo, dos empanadas iguales: cantidad 2 y nutrientes/peso del total). No dupliques ingredientes equivalentes. Marca cada ingrediente con origen "usuario" cuando fue nombrado o cuantificado explícitamente, y "inferido" cuando lo dedujiste. El campo "supuesto" debe reflejar si fue inferido. Sugiere hasta 6 correcciones breves y relevantes para este plato; no uses opciones genéricas que no correspondan.
`;

export const MODELOS_GEMINI = [
  { id: "gemini-3.7-flash", nombre: "Gemini 3.7 Flash", etiqueta: "Última generación", descripcion: "Modelo más reciente y avanzado con alta velocidad y visión" },
  { id: "gemini-3.6-flash", nombre: "Gemini 3.6 Flash", etiqueta: "Serie 3 Flash", descripcion: "Excelente equilibrio de inteligencia multimodal y rapidez" },
  { id: "gemini-3.5-flash", nombre: "Gemini 3.5 Flash", etiqueta: "Serie 3 Flash", descripcion: "Gran fluidez y precisión para análisis nutricional" },
  { id: "gemini-2.5-flash", nombre: "Gemini 2.5 Flash", etiqueta: "Estándar 2.5", descripcion: "Muy preciso en desglose visual de ingredientes y porciones" },
  { id: "gemini-2.0-flash", nombre: "Gemini 2.0 Flash", etiqueta: "Rápido y Estable", descripcion: "Excelente alternativa cuando hay alto tráfico en series 3 o 2.5" },
  { id: "gemini-2.0-flash-lite", nombre: "Gemini 2.0 Flash Lite", etiqueta: "Alta disponibilidad", descripcion: "Ultra ligero y diseñado para bajo consumo de cuota" },
  { id: "gemini-1.5-flash", nombre: "Gemini 1.5 Flash", etiqueta: "Clásico confiable", descripcion: "Cuotas muy amplias y excelente estabilidad" },
  { id: "gemini-2.5-pro", nombre: "Gemini 2.5 Pro", etiqueta: "Máxima precisión", descripcion: "Análisis profundo para platos complejos con múltiples salsas" },
  { id: "gemini-1.5-pro", nombre: "Gemini 1.5 Pro", etiqueta: "Razonamiento Pro", descripcion: "Modelo de razonamiento profundo clásico" }
];

export const MODELO_PREDETERMINADO = "gemini-2.5-flash";

export function obtenerModeloSeleccionado() {
  try {
    return localStorage.getItem("gemini_modelo_activo") || MODELO_PREDETERMINADO;
  } catch {
    return MODELO_PREDETERMINADO;
  }
}

export function guardarModeloSeleccionado(modeloId) {
  try {
    localStorage.setItem("gemini_modelo_activo", modeloId);
  } catch (e) {
    console.error("Error al guardar modelo en localStorage", e);
  }
}

/**
 * Procesa y valida la respuesta JSON de Gemini.
 */
async function procesarRespuestaGemini(response, modeloActivo, fechaReferencia, fechaForzada = null, incluirOrigen = false) {
  if (!response.ok) {
    const errorBody = await response.text();
    let errorMsg = `Error de Gemini API (${response.status})`;
    try {
      const errJson = JSON.parse(errorBody);
      if (errJson?.error?.message) {
        errorMsg = errJson.error.message;
      }
    } catch {
      // Usar errorMsg por defecto
    }

    if (response.status === 429 || errorMsg.toLowerCase().includes("quota") || errorMsg.toLowerCase().includes("resource_exhausted")) {
      throw new Error(`El modelo "${modeloActivo}" está saturado o excedió la cuota de peticiones por minuto. Prueba cambiar a otro modelo (ej. Gemini 2.0 Flash o 1.5 Flash) en el selector.`);
    } else if (response.status === 503 || errorMsg.toLowerCase().includes("overloaded")) {
      throw new Error(`El modelo "${modeloActivo}" está sobrecargado temporalmente en Google. Por favor selecciona otro modelo para analizar de inmediato.`);
    } else if (response.status === 404 || errorMsg.toLowerCase().includes("not found")) {
      throw new Error(`El modelo "${modeloActivo}" no se encuentra disponible con tu API Key. Por favor selecciona otro modelo como Gemini 2.0 Flash o Gemini 2.5 Flash.`);
    }

    throw new Error(errorMsg);
  }

  const data = await response.json();
  const candidate = data?.candidates?.[0];
  const rawText = candidate?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error("No se recibió respuesta válida del agente Gemini.");
  }

  // Sanitizar posible bloque markdown ```json ... ``` si el modelo lo incluye
  let cleanJsonText = rawText.trim();
  if (cleanJsonText.startsWith("```")) {
    cleanJsonText = cleanJsonText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }

  let parsed;
  try {
    parsed = JSON.parse(cleanJsonText);
  } catch (err) {
    throw new Error("La respuesta del agente no es un JSON válido: " + err.message);
  }

  if (parsed.error) {
    throw new Error(parsed.error);
  }

  // Garantizar valores por defecto coherentes
  if (fechaForzada) {
    parsed.fecha = fechaForzada;
  } else if (!parsed.fecha || typeof parsed.fecha !== "string" || !parsed.fecha.includes("-")) {
    parsed.fecha = fechaReferencia;
  }

  // Si totales_plato no vino o está incompleto, calcular a partir de ingredientes
  if (!parsed.totales_plato && Array.isArray(parsed.ingredientes)) {
    parsed.totales_plato = parsed.ingredientes.reduce(
      (acc, ing) => ({
        calorias: acc.calorias + (Number(ing.calorias) || 0),
        proteinas_g: acc.proteinas_g + (Number(ing.proteinas_g) || 0),
        carbohidratos_g: acc.carbohidratos_g + (Number(ing.carbohidratos_g) || 0),
        grasas_g: acc.grasas_g + (Number(ing.grasas_g) || 0)
      }),
      { calorias: 0, proteinas_g: 0, carbohidratos_g: 0, grasas_g: 0 }
    );
  }

  const normalizarConfianza = (valor, predeterminado = "media") => {
    const normalizada = String(valor || predeterminado).trim().toLocaleLowerCase("es-AR");
    return ["alta", "media", "baja"].includes(normalizada) ? normalizada : predeterminado;
  };
  const confianzaGeneral = normalizarConfianza(parsed.confianza_general || parsed.nivel_confianza);
  parsed.confianza_general = confianzaGeneral;
  parsed.nivel_confianza = confianzaGeneral.charAt(0).toLocaleUpperCase("es-AR") + confianzaGeneral.slice(1);
  const ingredientesNormalizados = (Array.isArray(parsed.ingredientes) ? parsed.ingredientes : []).map((ingrediente) => {
    const partesNombre = String(ingrediente.nombre || "Ingrediente").split("/").map((parte) => parte.trim()).filter(Boolean);
    const nombre = partesNombre[0] || "Ingrediente";
    const origen = ["usuario", "inferido"].includes(String(ingrediente.origen || "").toLowerCase())
      ? String(ingrediente.origen).toLowerCase()
      : "inferido";
    return {
      ...ingrediente,
      nombre,
      alias: (typeof ingrediente.alias === "string" && ingrediente.alias.trim()) || partesNombre[1] || null,
      cantidad: Math.max(1, Math.round(Number(ingrediente.cantidad) || 1)),
      confianza: normalizarConfianza(ingrediente.confianza, confianzaGeneral),
      ...(incluirOrigen ? {
        origen,
        supuesto: Boolean(ingrediente.supuesto || origen === "inferido")
      } : {})
    };
  });
  const ingredientesAgrupados = new Map();
  for (const ingrediente of ingredientesNormalizados) {
    const clave = ingrediente.nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-AR").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    const existente = ingredientesAgrupados.get(clave);
    if (!existente) {
      ingredientesAgrupados.set(clave, { ...ingrediente });
      continue;
    }
    existente.cantidad += ingrediente.cantidad;
    if (ingrediente.origen === "usuario") existente.origen = "usuario";
    for (const campo of ["peso_estimado_g", "calorias", "proteinas_g", "carbohidratos_g", "grasas_g"]) {
      existente[campo] = (Number(existente[campo]) || 0) + (Number(ingrediente[campo]) || 0);
    }
    if (existente.confianza !== ingrediente.confianza) existente.confianza = confianzaGeneral;
  }
  parsed.ingredientes = [...ingredientesAgrupados.values()];
  parsed.sugerencias_correccion = Array.isArray(parsed.sugerencias_correccion)
    ? [...new Set(parsed.sugerencias_correccion.filter((sugerencia) => typeof sugerencia === "string").map((sugerencia) => sugerencia.trim()).filter(Boolean))].slice(0, 6)
    : [];

  return parsed;
}

/**
 * Analiza una imagen de comida usando la API de Gemini.
 * @param {Object} params
 * @param {string} params.base64Data - Imagen en base64 (sin el prefijo data:image/...)
 * @param {string} params.mimeType - MIME type de la imagen (ej: image/jpeg, image/png)
 * @param {string} [params.detallesAdicionales] - Instrucciones o supuestos adicionales
 * @param {string} [params.modelo] - Identificador del modelo Gemini a utilizar
 * @returns {Promise<Object>} Registro estructurado listo para la BD
 */
export async function analizarFotoComida({
  base64Data,
  mimeType = "image/jpeg",
  detallesAdicionales = "",
  modelo = null,
  signal
}) {
  if (!isGeminiConfigured) {
    throw new Error("No se ha configurado la API Key de Gemini en el archivo .env (VITE_API_GEMINI).");
  }

  const modeloActivo = modelo || obtenerModeloSeleccionado();
  const fechaReferencia = obtenerFechaActualLocal();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modeloActivo}:generateContent?key=${geminiApiKey}`;

  let promptUsuario = `Analiza esta comida según tus instrucciones. Fecha actual de registro: "${fechaReferencia}".`;
  if (detallesAdicionales && detallesAdicionales.trim()) {
    promptUsuario += `\n\nDETALLES ADICIONALES E INGREDIENTES OCULTOS INDICADOS POR EL USUARIO:\n"${detallesAdicionales.trim()}"\nConsidera e integra explícitamente estos detalles (método de cocción, tipo o cantidad de aceite, aderezos, salsas, ingredientes no visibles) para calibrar con precisión los ingredientes, calorías y macronutrientes del plato.`;
  }
  promptUsuario += `\n\nGenera el JSON completo estructurado.`;

  const payload = {
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT_FOTO }]
    },
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Data
            }
          },
          {
            text: promptUsuario
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2
    }
  };

  const response = await fetch(url, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return procesarRespuestaGemini(response, modeloActivo, fechaReferencia);
}

/**
 * Analiza una descripción en texto libre de comida usando la API de Gemini.
 * @param {Object} params
 * @param {string} params.descripcion - Texto descriptivo de lo que consumió el usuario
 * @param {string} [params.detallesAdicionales] - Aclaraciones adicionales
 * @param {string} [params.modelo] - Identificador del modelo Gemini a utilizar
 * @returns {Promise<Object>} Registro estructurado listo para la BD
 */
export async function analizarTextoComida({
  descripcion,
  detallesAdicionales = "",
  fechaComida = null,
  modelo = null
}) {
  if (!isGeminiConfigured) {
    throw new Error("No se ha configurado la API Key de Gemini en el archivo .env (VITE_API_GEMINI).");
  }

  if (!descripcion || !descripcion.trim()) {
    throw new Error("Por favor escribe qué comiste o tomaste.");
  }

  const modeloActivo = modelo || obtenerModeloSeleccionado();
  const fechaReferencia = fechaComida || obtenerFechaActualLocal();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modeloActivo}:generateContent?key=${geminiApiKey}`;

  let promptUsuario = `Estima esta comida descrita por el usuario. No hagas preguntas. Respeta todo nombre, cantidad, unidad o gramo explícito; infiere solo lo que no se indicó.\nFecha y hora elegidas por el usuario para registrar esta comida: "${fechaReferencia}". Usa exactamente este valor en el campo fecha; no uses la hora actual.\n\nDESCRIPCIÓN DE LO CONSUMIDO:\n"${descripcion.trim()}"`;
  if (detallesAdicionales && detallesAdicionales.trim()) {
    promptUsuario += `\n\nDETALLES O ACLARACIONES ADICIONALES:\n"${detallesAdicionales.trim()}"`;
  }
  promptUsuario += `\n\nGenera el JSON completo estructurado.`;

  const payload = {
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT_TEXTO }]
    },
    contents: [
      {
        parts: [
          {
            text: promptUsuario
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return procesarRespuestaGemini(response, modeloActivo, fechaReferencia, fechaReferencia, true);
}

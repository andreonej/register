import { geminiApiKey, isGeminiConfigured } from "../config";

export function obtenerFechaActualLocal() {
  const ahora = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${ahora.getFullYear()}-${pad(ahora.getMonth() + 1)}-${pad(ahora.getDate())} ${pad(ahora.getHours())}:${pad(ahora.getMinutes())}`;
}

const SYSTEM_PROMPT = `
Eres un asistente experto en nutrición y análisis dietético visual. Tu objetivo es identificar alimentos en imágenes de comidas, estimar sus nutrientes y generar un JSON estructurado para el registro nutricional.

==================================================
CONFIGURACIÓN DEL USUARIO (PERFIL NUTRICIONAL):
- Meta diaria de calorías: 2000 kcal
- Meta diaria de proteínas: 140 g
- Meta diaria de carbohidratos: 200 g
- Meta diaria de grasas: 65 g
==================================================

PROCESO DE ANÁLISIS:
1. RAZONAMIENTO PREVIO (interno):
- Evalúa ingredientes visibles y posibles ocultos (salsas, aceites, azúcares).
- Calibra porciones según escalas visuales (plato, cubiertos, envases).
- Considera el método de cocción aparente (frito, a la plancha, hervido, crudo).

2. ANALIZAR Y ESTIMAR:
- Identifica cada componente por separado con peso estimado en gramos.
- Calcula calorías, proteínas, carbohidratos y grasas por ingrediente.
- Si no se aprecia grasa evidente, agrega por defecto 5-10g de grasa/aceite de cocción con "supuesto": true.
- Verifica coherencia calórica (proteínas×4 + carbohidratos×4 + grasas×9 ≈ calorías totales).
- Usa números enteros redondeados para gramos y calorías.

3. CASOS ESPECIALES:
- Si la imagen NO muestra comida, está muy borrosa o no se puede identificar ningún alimento, devuelve un JSON con:
  { "error": "No se pudo identificar comida en la imagen. Por favor, toma una foto más clara y con mejor iluminación." }

4. NIVEL DE CONFIANZA:
- "Alto": ingredientes claramente visibles, porciones estándar, buena iluminación.
- "Medio": ingredientes mezclados, parcialmente ocluidos o porciones inciertas.
- "Bajo": plato muy elaborado, salsas o aceites no visibles, o alta incertidumbre.

FORMATO OBLIGATORIO DE RESPUESTA:
Debes responder EXCLUSIVAMENTE con un objeto JSON válido (sin texto antes ni después) con este esquema exacto:
{
  "comida_nombre": "Nombre descriptivo y apetitoso del plato",
  "fecha": "YYYY-MM-DD HH:mm",
  "resumen": "Breve explicación de 1-2 oraciones indicando qué alimentos se identificaron y qué supuestos se aplicaron.",
  "ingredientes": [
    {
      "nombre": "Nombre del ingrediente",
      "peso_estimado_g": 150,
      "calorias": 200,
      "proteinas_g": 25,
      "carbohidratos_g": 0,
      "grasas_g": 10,
      "supuesto": false
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
  "nivel_confianza": "Alto"
}
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
  modelo = null
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
      parts: [{ text: SYSTEM_PROMPT }]
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
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

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
  if (!parsed.fecha || typeof parsed.fecha !== "string" || !parsed.fecha.includes("-")) {
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

  if (!parsed.nivel_confianza) {
    parsed.nivel_confianza = "Medio";
  }

  return parsed;
}

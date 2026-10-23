/**
 * Netlify Function: Proxy seguro para Google Gemini API.
 * Oculta la API Key de Gemini en el backend del servidor.
 */

const MODELOS_PERMITIDOS = new Set([
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemini-2.5-pro",
  "gemini-1.5-pro"
]);

export default async (req, context) => {
  // Manejo de preflight CORS si fuera necesario
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: { message: "Método no permitido. Solo se acepta POST." } }),
      {
        status: 405,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  const apiKey = (process.env.GEMINI_API_KEY || process.env.VITE_API_GEMINI || "").trim();
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: {
          message: "No se ha configurado la variable de entorno GEMINI_API_KEY en Netlify."
        }
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  try {
    const body = await req.json();
    const { modelo, payload } = body || {};

    if (!modelo || typeof modelo !== "string") {
      return new Response(
        JSON.stringify({ error: { message: "El parámetro 'modelo' es requerido." } }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!payload || typeof payload !== "object") {
      return new Response(
        JSON.stringify({ error: { message: "El parámetro 'payload' es requerido y debe ser un objeto." } }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const modeloNormalizado = modelo.trim();
    if (!MODELOS_PERMITIDOS.has(modeloNormalizado)) {
      return new Response(
        JSON.stringify({
          error: {
            message: `El modelo '${modeloNormalizado}' no está permitido.`
          }
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modeloNormalizado)}:generateContent?key=${apiKey}`;

    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await geminiRes.text();

    return new Response(data, {
      status: geminiRes.status,
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: {
          message: err.message || "Error interno al comunicarse con el servicio de IA."
        }
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};

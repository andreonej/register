import { isSupabaseConfigured, supabaseApiUrl, supabaseHeaders } from "../config";
import { eliminarFotoComida, subirFotoComida } from "./fotos";
import { getNutrientGroup } from "../components/MealIcon";

function validarConfiguracion() {
  if (!isSupabaseConfigured) throw new Error("Falta configurar Supabase. Revisá el archivo .env.");
}

export async function obtenerComidas() {
  validarConfiguracion();
  const respuesta = await fetch(`${supabaseApiUrl}/comidas?select=*,comida_ingredientes(*)&order=fecha.desc&limit=200`, { headers: supabaseHeaders });
  if (!respuesta.ok) throw new Error("No se pudo conectar con la base de datos");
  return respuesta.json();
}

export async function crearComida(registro, perfilId = null) {
  validarConfiguracion();
  const totales = registro.totales_plato || {};
  const fecha = `${registro.fecha.replace(" ", "T")}:00-03:00`;
  const bodyPayload = {
    comida_nombre: registro.comida_nombre,
    fecha,
    calorias_totales: totales.calorias ?? null,
    proteinas_totales_g: totales.proteinas_g ?? null,
    carbohidratos_totales_g: totales.carbohidratos_g ?? null,
    grasas_totales_g: totales.grasas_g ?? null,
    nivel_confianza: registro.nivel_confianza ?? null,
    factor_porcion: Number.isFinite(Number(registro.factor_porcion)) && Number(registro.factor_porcion) > 0 && Number(registro.factor_porcion) <= 1
      ? Number(registro.factor_porcion)
      : 1
  };
  if (perfilId || registro.perfil_id) {
    bodyPayload.perfil_id = perfilId || registro.perfil_id;
  }
  const respuesta = await fetch(`${supabaseApiUrl}/comidas`, {
    method: "POST",
    headers: { ...supabaseHeaders, Prefer: "return=representation" },
    body: JSON.stringify(bodyPayload),
  });
  if (!respuesta.ok) throw new Error("No se pudo guardar la comida");
  const [comida] = await respuesta.json();
  if (registro.foto?.base64Data) {
    try {
      const fotoPath = await subirFotoComida({
        comidaId: comida.id,
        perfilId: bodyPayload.perfil_id,
        base64Data: registro.foto.base64Data,
        mimeType: registro.foto.mimeType,
      });
      const actualizacion = await fetch(`${supabaseApiUrl}/comidas?id=eq.${comida.id}`, {
        method: "PATCH",
        headers: { ...supabaseHeaders, Prefer: "return=representation" },
        body: JSON.stringify({ foto_path: fotoPath }),
      });
      if (!actualizacion.ok) throw new Error("No se pudo vincular la foto a la comida");
      comida.foto_path = fotoPath;
    } catch (error) {
      console.warn("La comida se guardó sin foto:", error.message);
      comida.foto_error = error.message;
    }
  }
  const ingredientes = (registro.ingredientes || []).map((ingrediente) => ({
    comida_id: comida.id,
    nombre: ingrediente.nombre,
    peso_estimado_g: ingrediente.peso_estimado_g ?? null,
    calorias: ingrediente.calorias ?? null,
    proteinas_g: ingrediente.proteinas_g ?? null,
    carbohidratos_g: ingrediente.carbohidratos_g ?? null,
    grasas_g: ingrediente.grasas_g ?? null,
    cantidad: Math.max(1, Math.round(Number(ingrediente.cantidad) || 1)),
    alias: ingrediente.alias || null,
    confianza: ["alta", "media", "baja"].includes(String(ingrediente.confianza || "").toLowerCase())
      ? String(ingrediente.confianza).toLowerCase()
      : null,
    supuesto: Boolean(ingrediente.supuesto || ingrediente.origen === "inferido"),
    grupo_nutricional: ingrediente.grupo_nutricional || getNutrientGroup(ingrediente.nombre)
  }));
  if (ingredientes.length) {
    const ingredientesRespuesta = await fetch(`${supabaseApiUrl}/comida_ingredientes`, { method: "POST", headers: supabaseHeaders, body: JSON.stringify(ingredientes) });
    if (!ingredientesRespuesta.ok) throw new Error("La comida se guardó, pero fallaron los ingredientes");
  }
  return comida;
}

export async function eliminarComida(comida) {
  validarConfiguracion();
  const respuesta = await fetch(`${supabaseApiUrl}/comidas?id=eq.${comida.id}`, { method: "DELETE", headers: supabaseHeaders });
  if (!respuesta.ok) throw new Error("No se pudo borrar el registro");
  try {
    await eliminarFotoComida(comida.foto_path);
  } catch (error) {
    console.warn("La comida se eliminó, pero quedó una foto pendiente de limpiar:", error.message);
  }
}

export async function actualizarComida(comida, ingredientes) {
  validarConfiguracion();
  const totales = ingredientes.reduce((suma, item) => ({
    calorias_totales: suma.calorias_totales + Number(item.calorias || 0),
    proteinas_totales_g: suma.proteinas_totales_g + Number(item.proteinas_g || 0),
    carbohidratos_totales_g: suma.carbohidratos_totales_g + Number(item.carbohidratos_g || 0),
    grasas_totales_g: suma.grasas_totales_g + Number(item.grasas_g || 0),
  }), { calorias_totales: 0, proteinas_totales_g: 0, carbohidratos_totales_g: 0, grasas_totales_g: 0 });
  const respuesta = await fetch(`${supabaseApiUrl}/comidas?id=eq.${comida.id}`, { method: "PATCH", headers: { ...supabaseHeaders, Prefer: "return=minimal" }, body: JSON.stringify(totales) });
  if (!respuesta.ok) throw new Error("No se pudieron guardar los totales de la comida");
  for (const ingrediente of ingredientes) {
    if (!ingrediente.id) continue;
    const actualizacion = await fetch(`${supabaseApiUrl}/comida_ingredientes?id=eq.${ingrediente.id}`, { method: "PATCH", headers: { ...supabaseHeaders, Prefer: "return=minimal" }, body: JSON.stringify({ peso_estimado_g: Number(ingrediente.peso_estimado_g), calorias: Number(ingrediente.calorias), proteinas_g: Number(ingrediente.proteinas_g), carbohidratos_g: Number(ingrediente.carbohidratos_g), grasas_g: Number(ingrediente.grasas_g) }) });
    if (!actualizacion.ok) throw new Error("No se pudieron guardar los ingredientes");
  }
  return { ...comida, ...totales, comida_ingredientes: ingredientes };
}

import { isSupabaseConfigured, supabaseApiUrl, supabaseHeaders } from "../config";

function validarConfiguracion() {
  if (!isSupabaseConfigured) throw new Error("Falta configurar Supabase. Revisá el archivo .env.");
}

export async function obtenerComidas() {
  validarConfiguracion();
  const respuesta = await fetch(`${supabaseApiUrl}/comidas?select=*,comida_ingredientes(*)&order=fecha.desc&limit=200`, { headers: supabaseHeaders });
  if (!respuesta.ok) throw new Error("No se pudo conectar con la base de datos");
  return respuesta.json();
}

export async function crearComida(registro) {
  validarConfiguracion();
  const totales = registro.totales_plato || {};
  const fecha = `${registro.fecha.replace(" ", "T")}:00-03:00`;
  const respuesta = await fetch(`${supabaseApiUrl}/comidas`, {
    method: "POST",
    headers: { ...supabaseHeaders, Prefer: "return=representation" },
    body: JSON.stringify({ comida_nombre: registro.comida_nombre, fecha, calorias_totales: totales.calorias ?? null, proteinas_totales_g: totales.proteinas_g ?? null, carbohidratos_totales_g: totales.carbohidratos_g ?? null, grasas_totales_g: totales.grasas_g ?? null, nivel_confianza: registro.nivel_confianza ?? null }),
  });
  if (!respuesta.ok) throw new Error("No se pudo guardar la comida");
  const [comida] = await respuesta.json();
  const ingredientes = (registro.ingredientes || []).map((ingrediente) => ({ comida_id: comida.id, nombre: ingrediente.nombre, peso_estimado_g: ingrediente.peso_estimado_g ?? null, calorias: ingrediente.calorias ?? null, proteinas_g: ingrediente.proteinas_g ?? null, carbohidratos_g: ingrediente.carbohidratos_g ?? null, grasas_g: ingrediente.grasas_g ?? null, supuesto: Boolean(ingrediente.supuesto) }));
  if (ingredientes.length) {
    const ingredientesRespuesta = await fetch(`${supabaseApiUrl}/comida_ingredientes`, { method: "POST", headers: supabaseHeaders, body: JSON.stringify(ingredientes) });
    if (!ingredientesRespuesta.ok) throw new Error("La comida se guardó, pero fallaron los ingredientes");
  }
  return comida;
}

export async function eliminarComida(id) {
  validarConfiguracion();
  const respuesta = await fetch(`${supabaseApiUrl}/comidas?id=eq.${id}`, { method: "DELETE", headers: supabaseHeaders });
  if (!respuesta.ok) throw new Error("No se pudo borrar el registro");
}

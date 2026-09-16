import { isSupabaseConfigured, supabaseApiUrl, supabaseHeaders } from "../config";

const PERFIL_STORAGE_KEY = "registro_comidas_perfil";
const PESOS_STORAGE_KEY = "registro_comidas_pesos";

const PERFIL_DEFAULT = {
  nombre: "Jose",
  sexo: "masculino",
  fecha_nacimiento: "1995-06-15",
  altura_cm: 175,
  nivel_actividad: "moderado",
  objetivo: "mantener",
  restricciones: "",
  zona_horaria: "America/Argentina/Buenos_Aires",
  peso_actual: 75
};

const PESOS_DEFAULT = [
  {
    id: "peso-inicial-1",
    peso_kg: 75,
    fecha: "2026-09-01",
    nota: "Peso inicial de referencia"
  }
];

function leerLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function guardarLocal(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Ignorar errores de quota local
  }
}

/**
 * Verifica el estado de las tablas de perfil en Supabase.
 */
export async function verificarTablasSupabase() {
  if (!isSupabaseConfigured) return { disponible: false, tablasCreadas: false };
  try {
    const [resPerfiles, resDatos, resPesos] = await Promise.all([
      fetch(`${supabaseApiUrl}/perfiles?limit=1`, { headers: supabaseHeaders }),
      fetch(`${supabaseApiUrl}/perfil_datos?limit=1`, { headers: supabaseHeaders }),
      fetch(`${supabaseApiUrl}/peso_registros?limit=1`, { headers: supabaseHeaders })
    ]);
    const tablasCreadas = resPerfiles.ok && resDatos.ok && resPesos.ok;
    return { disponible: true, tablasCreadas };
  } catch {
    return { disponible: false, tablasCreadas: false };
  }
}

/**
 * Obtiene el perfil activo del usuario (desde Supabase con fallback local).
 */
export async function obtenerPerfilActivo() {
  const perfilLocal = leerLocal(PERFIL_STORAGE_KEY, PERFIL_DEFAULT);
  const pesosLocales = leerLocal(PESOS_STORAGE_KEY, PESOS_DEFAULT);

  if (!isSupabaseConfigured) {
    const ultimoPeso = pesosLocales[0]?.peso_kg || perfilLocal.peso_actual || 75;
    return { ...perfilLocal, peso_actual: ultimoPeso };
  }

  try {
    // 1. Obtener o crear registro en `perfiles`
    let perfilSupabase = null;
    const resPerfiles = await fetch(`${supabaseApiUrl}/perfiles?order=created_at.asc&limit=1`, {
      headers: supabaseHeaders
    });

    if (resPerfiles.ok) {
      const perfiles = await resPerfiles.json();
      if (perfiles.length > 0) {
        perfilSupabase = perfiles[0];
      } else {
        // Crear perfil inicial
        const resCrear = await fetch(`${supabaseApiUrl}/perfiles`, {
          method: "POST",
          headers: { ...supabaseHeaders, Prefer: "return=representation" },
          body: JSON.stringify({ nombre: perfilLocal.nombre || "Jose" })
        });
        if (resCrear.ok) {
          const [creado] = await resCrear.json();
          perfilSupabase = creado;
        }
      }
    }

    if (!perfilSupabase) {
      return { ...perfilLocal, peso_actual: pesosLocales[0]?.peso_kg || 75 };
    }

    const perfilId = perfilSupabase.id;

    // 2. Intentar obtener `perfil_datos`
    let datosSupabase = null;
    const resDatos = await fetch(`${supabaseApiUrl}/perfil_datos?perfil_id=eq.${perfilId}&limit=1`, {
      headers: supabaseHeaders
    });
    if (resDatos.ok) {
      const listaDatos = await resDatos.json();
      if (listaDatos.length > 0) {
        datosSupabase = listaDatos[0];
      }
    }

    // 3. Intentar obtener último peso de `peso_registros`
    let pesoActual = pesosLocales[0]?.peso_kg || perfilLocal.peso_actual || 75;
    const resPesos = await fetch(`${supabaseApiUrl}/peso_registros?perfil_id=eq.${perfilId}&order=fecha.desc,created_at.desc&limit=1`, {
      headers: supabaseHeaders
    });
    if (resPesos.ok) {
      const listaPesos = await resPesos.json();
      if (listaPesos.length > 0) {
        pesoActual = Number(listaPesos[0].peso_kg);
      }
    }

    const perfilUnificado = {
      id: perfilId,
      nombre: perfilSupabase.nombre || perfilLocal.nombre || "Jose",
      sexo: datosSupabase?.sexo || perfilLocal.sexo || "masculino",
      fecha_nacimiento: datosSupabase?.fecha_nacimiento || perfilLocal.fecha_nacimiento || "1995-06-15",
      altura_cm: Number(datosSupabase?.altura_cm || perfilLocal.altura_cm || 175),
      nivel_actividad: datosSupabase?.nivel_actividad || perfilLocal.nivel_actividad || "moderado",
      objetivo: datosSupabase?.objetivo || perfilLocal.objetivo || "mantener",
      restricciones: datosSupabase?.restricciones ?? perfilLocal.restricciones ?? "",
      zona_horaria: datosSupabase?.zona_horaria || perfilLocal.zona_horaria || "America/Argentina/Buenos_Aires",
      peso_actual: pesoActual
    };

    guardarLocal(PERFIL_STORAGE_KEY, perfilUnificado);
    return perfilUnificado;
  } catch {
    return { ...perfilLocal, peso_actual: pesosLocales[0]?.peso_kg || 75 };
  }
}

/**
 * Guarda los cambios del perfil en Supabase y localmente.
 */
export async function guardarPerfil(datos) {
  guardarLocal(PERFIL_STORAGE_KEY, datos);

  if (!isSupabaseConfigured || !datos.id) return datos;

  try {
    // Actualizar nombre en `perfiles`
    if (datos.nombre) {
      await fetch(`${supabaseApiUrl}/perfiles?id=eq.${datos.id}`, {
        method: "PATCH",
        headers: supabaseHeaders,
        body: JSON.stringify({ nombre: datos.nombre })
      });
    }

    // Upsert en `perfil_datos`
    const payloadDatos = {
      perfil_id: datos.id,
      sexo: datos.sexo,
      fecha_nacimiento: datos.fecha_nacimiento,
      altura_cm: Number(datos.altura_cm),
      nivel_actividad: datos.nivel_actividad,
      objetivo: datos.objetivo,
      restricciones: datos.restricciones,
      zona_horaria: datos.zona_horaria,
      updated_at: new Date().toISOString()
    };

    await fetch(`${supabaseApiUrl}/perfil_datos`, {
      method: "POST",
      headers: {
        ...supabaseHeaders,
        Prefer: "resolution=merge-duplicates"
      },
      body: JSON.stringify(payloadDatos)
    });
  } catch (err) {
    console.warn("No se pudo sincronizar perfil con Supabase (se guardó localmente):", err.message);
  }

  return datos;
}

/**
 * Obtiene el historial de pesaje (orden cronológico descendente).
 */
export async function obtenerHistorialPesos(perfilId) {
  const pesosLocales = leerLocal(PESOS_STORAGE_KEY, PESOS_DEFAULT);

  if (!isSupabaseConfigured || !perfilId) {
    return pesosLocales;
  }

  try {
    const res = await fetch(`${supabaseApiUrl}/peso_registros?perfil_id=eq.${perfilId}&order=fecha.desc,created_at.desc&limit=100`, {
      headers: supabaseHeaders
    });

    if (res.ok) {
      const remotos = await res.json();
      if (remotos.length > 0) {
        guardarLocal(PESOS_STORAGE_KEY, remotos);
        return remotos;
      }
    }
  } catch (err) {
    console.warn("Usando historial de pesos local:", err.message);
  }

  return pesosLocales;
}

/**
 * Registra una nueva entrada de peso.
 */
export async function registrarPeso({ perfilId, pesoKg, fecha, nota = "" }) {
  const pesoNumero = Number(pesoKg);
  const nuevoRegistro = {
    id: `peso-${Date.now()}`,
    perfil_id: perfilId || null,
    peso_kg: pesoNumero,
    fecha: fecha || new Date().toISOString().slice(0, 10),
    nota: nota.trim()
  };

  const pesosActuales = leerLocal(PESOS_STORAGE_KEY, PESOS_DEFAULT);
  const actualizados = [nuevoRegistro, ...pesosActuales.filter((p) => p.fecha !== nuevoRegistro.fecha || p.id !== nuevoRegistro.id)];
  actualizados.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  guardarLocal(PESOS_STORAGE_KEY, actualizados);

  // Actualizar también el peso_actual en el perfil local
  const perfilLocal = leerLocal(PERFIL_STORAGE_KEY, PERFIL_DEFAULT);
  guardarLocal(PERFIL_STORAGE_KEY, { ...perfilLocal, peso_actual: pesoNumero });

  if (isSupabaseConfigured && perfilId) {
    try {
      const res = await fetch(`${supabaseApiUrl}/peso_registros`, {
        method: "POST",
        headers: { ...supabaseHeaders, Prefer: "return=representation" },
        body: JSON.stringify({
          perfil_id: perfilId,
          peso_kg: pesoNumero,
          fecha: nuevoRegistro.fecha,
          nota: nuevoRegistro.nota
        })
      });
      if (res.ok) {
        const [creado] = await res.json();
        const sincronizados = [creado, ...pesosActuales.filter((p) => p.id !== nuevoRegistro.id)];
        guardarLocal(PESOS_STORAGE_KEY, sincronizados);
        return creado;
      }
    } catch (err) {
      console.warn("Registro de peso guardado localmente (fallo sync Supabase):", err.message);
    }
  }

  return nuevoRegistro;
}

/**
 * Elimina una entrada del historial de pesaje.
 */
export async function eliminarRegistroPeso(id) {
  const pesosActuales = leerLocal(PESOS_STORAGE_KEY, []);
  const filtrados = pesosActuales.filter((p) => p.id !== id);
  guardarLocal(PESOS_STORAGE_KEY, filtrados);

  if (isSupabaseConfigured && !id.startsWith("peso-")) {
    try {
      await fetch(`${supabaseApiUrl}/peso_registros?id=eq.${id}`, {
        method: "DELETE",
        headers: supabaseHeaders
      });
    } catch {
      // Ignorar
    }
  }
}

/**
 * Asocia comidas que tengan perfil_id = null al perfil activo.
 */
export async function asociarComidasHuerfanas(perfilId) {
  if (!isSupabaseConfigured || !perfilId) return 0;
  try {
    const res = await fetch(`${supabaseApiUrl}/comidas?perfil_id=is.null`, {
      method: "PATCH",
      headers: { ...supabaseHeaders, Prefer: "return=representation" },
      body: JSON.stringify({ perfil_id: perfilId })
    });
    if (res.ok) {
      const actualizadas = await res.json();
      return actualizadas.length;
    }
  } catch (err) {
    console.warn("No se pudieron asociar comidas huérfanas:", err.message);
  }
  return 0;
}

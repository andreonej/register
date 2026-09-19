import { fechaLocalDia } from "./date";

/**
 * Motor de Inteligencia Nutricional para el análisis de Progreso.
 */

// Categorías de micronutrientes / grupos de ingredientes
const INGREDIENTES_PROTEICOS = [
  "pollo", "pechuga", "huevo", "huevos", "atun", "atún", "carne", "lomo", "bife",
  "merluza", "salmon", "salmón", "pescado", "yogur", "yogurt", "queso", "cottage",
  "proteina", "whey", "lentejas", "garbanzos", "tofu", "soja", "cerdo", "pavo"
];

function normalizarTexto(txt) {
  return (txt || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Procesa y analiza las comidas históricas para generar insights contextuales.
 */
export function analizarProgreso({
  comidas = [],
  objetivos = { calorias: 2000, proteinas: 140, carbohidratos: 200, grasas: 65 },
  perfil = {},
  historialPesos = []
}) {
  const objetivoTipo = perfil?.objetivo || "mantener"; // "bajar" | "subir" | "mantener"
  const tdeeUsuario = perfil?.tdee || (objetivoTipo === "bajar" ? objetivos.calorias + 400 : objetivoTipo === "subir" ? Math.max(1600, objetivos.calorias - 350) : objetivos.calorias);

  // 1. Agrupar por los últimos 7 días
  const hoy = new Date();
  const ultimos7Dias = Array.from({ length: 7 }, (_, i) => {
    const fecha = new Date(hoy);
    fecha.setDate(hoy.getDate() - 6 + i);
    const diaIso = fechaLocalDia(fecha);
    const esFinDeSemana = fecha.getDay() === 0 || fecha.getDay() === 6;
    return {
      dia: diaIso,
      fechaObj: fecha,
      esFinDeSemana,
      etiqueta: fecha.toLocaleDateString("es-AR", { weekday: "short" }).replace(".", ""),
      esHoy: diaIso === fechaLocalDia(hoy),
      calorias: 0,
      proteinas: 0,
      carbohidratos: 0,
      grasas: 0,
      comidas: []
    };
  });

  // Mapear comidas a sus días
  const diasMap = {};
  ultimos7Dias.forEach((d) => { diasMap[d.dia] = d; });

  const todosIngredientes = [];

  comidas.forEach((comida) => {
    const diaIso = fechaLocalDia(comida.fecha);
    const cals = Number(comida.calorias_totales || 0);
    const prot = Number(comida.proteinas_totales_g || 0);
    const carb = Number(comida.carbohidratos_totales_g || 0);
    const fat = Number(comida.grasas_totales_g || 0);

    if (diasMap[diaIso]) {
      diasMap[diaIso].calorias += cals;
      diasMap[diaIso].proteinas += prot;
      diasMap[diaIso].carbohidratos += carb;
      diasMap[diaIso].grasas += fat;
      diasMap[diaIso].comidas.push(comida);
    }

    // Extraer ingredientes para análisis de hábitos
    const ingList = comida.comida_ingredientes || comida.ingredientes || [];
    ingList.forEach((ing) => {
      todosIngredientes.push({
        nombre: ing.nombre,
        calorias: Number(ing.calorias || 0),
        proteinas_g: Number(ing.proteinas_g || 0),
        carbohidratos_g: Number(ing.carbohidratos_g || 0),
        grasas_g: Number(ing.grasas_g || 0),
        peso_g: Number(ing.peso_estimado_g || 0),
        fecha: comida.fecha,
        diaIso
      });
    });
  });

  // 2. Definir bandas y estados para cada día
  const pisoCalorias = objetivoTipo === "bajar"
    ? Math.max(1200, objetivos.calorias - 250)
    : objetivoTipo === "subir"
    ? Math.max(1600, objetivos.calorias - 100)
    : objetivos.calorias - 150;

  const techoCalorias = objetivoTipo === "bajar"
    ? objetivos.calorias + 100
    : objetivoTipo === "subir"
    ? objetivos.calorias + 400
    : objetivos.calorias + 150;

  ultimos7Dias.forEach((d) => {
    if (d.calorias === 0) {
      d.estado = "vacio";
      d.colorBarra = "#e5e5e3";
    } else if (objetivoTipo === "bajar") {
      if (d.calorias < pisoCalorias) {
        d.estado = "piso_bajo";
        d.colorBarra = "#818cf8"; // Violeta: Piso saludable no alcanzado
      } else if (d.calorias <= techoCalorias) {
        d.estado = "en_meta";
        d.colorBarra = "#10b981"; // Verde esmeralda: Déficit perfecto
      } else {
        d.estado = "exceso";
        d.colorBarra = "#f59e0b"; // Ámbar/Naranja: Superó el techo
      }
    } else if (objetivoTipo === "subir") {
      if (d.calorias >= pisoCalorias) {
        d.estado = "en_meta";
        d.colorBarra = "#10b981"; // Verde: Logró superávit
      } else {
        d.estado = "corto";
        d.colorBarra = "#f43f5e"; // Rosa/Rojo: Se quedó corto
      }
    } else {
      // Mantener
      if (d.calorias >= pisoCalorias && d.calorias <= techoCalorias) {
        d.estado = "en_meta";
        d.colorBarra = "#10b981";
      } else {
        d.estado = "desviado";
        d.colorBarra = "#f59e0b";
      }
    }
  });

  const diasRegistrados = ultimos7Dias.filter((d) => d.calorias > 0);
  const diasEnMeta = diasRegistrados.filter((d) => d.estado === "en_meta");
  const totalCalorias = diasRegistrados.reduce((acc, d) => acc + d.calorias, 0);
  const promedioCalorias = diasRegistrados.length ? Math.round(totalCalorias / diasRegistrados.length) : 0;
  const promedioProteinas = diasRegistrados.length ? Math.round(diasRegistrados.reduce((acc, d) => acc + d.proteinas, 0) / diasRegistrados.length) : 0;
  const promedioCarbos = diasRegistrados.length ? Math.round(diasRegistrados.reduce((acc, d) => acc + d.carbohidratos, 0) / diasRegistrados.length) : 0;
  const promedioGrasas = diasRegistrados.length ? Math.round(diasRegistrados.reduce((acc, d) => acc + d.grasas, 0) / diasRegistrados.length) : 0;

  // 3. Métrica Héroe Adaptativa según Objetivo
  let heroInfo = {};

  if (objetivoTipo === "bajar") {
    const deficitSemanalTotal = diasRegistrados.reduce((acc, d) => acc + (tdeeUsuario - d.calorias), 0);
    const deficitPromedio = diasRegistrados.length ? Math.round(deficitSemanalTotal / diasRegistrados.length) : 0;
    const gramosGrasaEstimados = Math.round((Math.max(0, deficitSemanalTotal) / 7700) * 1000); // 7700 kcal ≈ 1kg grasa

    heroInfo = {
      tipo: "bajar",
      tituloHéroe: "Déficit acumulado",
      valorPrincipal: `${deficitSemanalTotal > 0 ? "-" : "+"}${Math.abs(deficitSemanalTotal).toLocaleString()}`,
      unidadPrincipal: "kcal esta semana",
      subtitulo: `${diasEnMeta.length} de ${diasRegistrados.length} días en banda óptima (${pisoCalorias}–${techoCalorias} kcal)`,
      badgeTexto: deficitPromedio >= 250 ? "Ritmo Óptimo" : deficitPromedio > 0 ? "Déficit Moderado" : "Sin déficit",
      badgeTipo: deficitPromedio >= 250 ? "exito" : "aviso",
      detalleRitmo: deficitSemanalTotal > 0
        ? `Equivale a aprox. ${gramosGrasaEstimados}g de grasa corporal movilizada esta semana.`
        : "Esta semana el balance neto fue en equilibrio o superávit.",
      avisoPiso: diasRegistrados.some((d) => d.estado === "piso_bajo")
        ? "Hay días con ingesta por debajo del piso saludable (1200 kcal). Cuidá no restringir de más para preservar tu masa muscular."
        : null
    };
  } else if (objetivoTipo === "subir") {
    const superavitSemanal = diasRegistrados.reduce((acc, d) => acc + (d.calorias - tdeeUsuario), 0);
    const cumplimientoProt = objetivos.proteinas > 0 ? Math.round((promedioProteinas / objetivos.proteinas) * 100) : 100;

    heroInfo = {
      tipo: "subir",
      tituloHéroe: "Proteína y Superávit",
      valorPrincipal: `${promedioProteinas}g`,
      unidadPrincipal: `/ ${objetivos.proteinas}g prot diaria`,
      subtitulo: `${cumplimientoProt}% de tu meta de proteína · ${diasEnMeta.length} de ${diasRegistrados.length} días con superávit`,
      badgeTexto: cumplimientoProt >= 95 ? "Superávit Proteico" : "Requiere más proteína",
      badgeTipo: cumplimientoProt >= 95 ? "exito" : "alerta",
      detalleRitmo: `Superávit neto acumulado: ${superavitSemanal > 0 ? "+" : ""}${superavitSemanal} kcal esta semana.`,
      avisoPiso: diasRegistrados.some((d) => d.estado === "corto")
        ? "En algunos días te quedaste corto del superávit calórico necesario para construcción muscular."
        : null
    };
  } else {
    // Mantener peso
    const desviacionPromedio = diasRegistrados.length
      ? Math.round(diasRegistrados.reduce((acc, d) => acc + Math.abs(d.calorias - objetivos.calorias), 0) / diasRegistrados.length)
      : 0;

    heroInfo = {
      tipo: "mantener",
      tituloHéroe: "Estabilidad Energética",
      valorPrincipal: `${diasEnMeta.length} / ${diasRegistrados.length || 7}`,
      unidadPrincipal: "días en rango",
      subtitulo: `Desviación promedio de ±${desviacionPromedio} kcal frente a tu meta de ${objetivos.calorias} kcal`,
      badgeTexto: diasEnMeta.length >= 5 ? "Alta Estabilidad" : "Variación Moderada",
      badgeTipo: diasEnMeta.length >= 5 ? "exito" : "neutro",
      detalleRitmo: `Promedio diario: ${promedioCalorias} kcal (Meta: ${objetivos.calorias} kcal).`,
      avisoPiso: null
    };
  }

  // 4. Inteligencia de Ingredientes: Top ADN y Frecuencia
  const conteoIngredientes = {};
  todosIngredientes.forEach((ing) => {
    const nombreNorm = normalizarTexto(ing.nombre);
    if (!nombreNorm || nombreNorm.length < 3) return;
    if (!conteoIngredientes[nombreNorm]) {
      conteoIngredientes[nombreNorm] = {
        nombreOriginal: ing.nombre,
        nombreNorm,
        veces: 0,
        caloriasTotales: 0,
        proteinasTotales: 0,
        grasasTotales: 0,
        pesosTotales: 0
      };
    }
    conteoIngredientes[nombreNorm].veces += 1;
    conteoIngredientes[nombreNorm].caloriasTotales += ing.calorias;
    conteoIngredientes[nombreNorm].proteinasTotales += ing.proteinas_g;
    conteoIngredientes[nombreNorm].grasasTotales += ing.grasas_g;
    conteoIngredientes[nombreNorm].pesosTotales += ing.peso_g;
  });

  const listaIngredientesTop = Object.values(conteoIngredientes)
    .sort((a, b) => b.veces - a.veces || b.caloriasTotales - a.caloriasTotales)
    .slice(0, 10);

  // Diversidad de plantas/ingredientes en los últimos 7 días
  const ingredientesSemana = new Set(
    todosIngredientes
      .filter((ing) => diasMap[ing.diaIso])
      .map((ing) => normalizarTexto(ing.nombre))
      .filter(Boolean)
  );
  const scoreDiversidad = ingredientesSemana.size;

  // 5. Cerrar la brecha ("Comé esto con lo que ya tenés en tu dieta")
  const diaHoy = ultimos7Dias.find((d) => d.esHoy) || ultimos7Dias[ultimos7Dias.length - 1];
  const proteinasFaltantesHoy = Math.max(0, objetivos.proteinas - (diaHoy?.proteinas || 0));
  const caloriasRestantesHoy = Math.max(0, objetivos.calorias - (diaHoy?.calorias || 0));

  // Buscar alimentos proteicos habituales del usuario
  const proteicosHabituales = Object.values(conteoIngredientes).filter((ing) => {
    const norm = ing.nombreNorm;
    return INGREDIENTES_PROTEICOS.some((p) => norm.includes(p));
  });

  const sugerenciasBrecha = [];
  if (proteinasFaltantesHoy > 15) {
    if (proteicosHabituales.length > 0) {
      const topProt1 = proteicosHabituales[0];
      const gramosAprox = Math.round((proteinasFaltantesHoy / 0.22)); // ~22g prot cada 100g de carne/pollo
      sugerenciasBrecha.push({
        titulo: `Añadir ~${Math.min(250, Math.max(80, gramosAprox))}g de ${topProt1.nombreOriginal}`,
        aporte: `+${proteinasFaltantesHoy}g proteína`,
        motivo: "Alimento habitual en tus registros"
      });
      if (proteicosHabituales.length > 1) {
        const topProt2 = proteicosHabituales[1];
        sugerenciasBrecha.push({
          titulo: `Combinar con ${topProt2.nombreOriginal}`,
          aporte: "Opción rápida y equilibrada",
          motivo: "Ajustado a tu repertorio frecuente"
        });
      }
    } else {
      // Sugerencias generales inteligentes
      sugerenciasBrecha.push({
        titulo: `150g Pechuga de pollo o Atún (~35g prot)`,
        aporte: `Cubre tu faltante de ${proteinasFaltantesHoy}g`,
        motivo: "Alta densidad proteica y bajas calorías"
      });
      sugerenciasBrecha.push({
        titulo: `2 Huevos + 150g Yogur griego (~28g prot)`,
        aporte: `Aporte completo y saciante`,
        motivo: "Fácil de preparar como merienda/cena"
      });
    }
  }

  // 6. Diagnóstico & Atribución (qué explica los desvíos)
  const ingredientesPorCalorias = Object.values(conteoIngredientes)
    .sort((a, b) => b.caloriasTotales - a.caloriasTotales);

  const topCalorico = ingredientesPorCalorias[0];
  let diagnosticoAtribucion = null;
  if (topCalorico && totalCalorias > 0) {
    const pctCalorias = Math.round((topCalorico.caloriasTotales / totalCalorias) * 100);
    if (pctCalorias >= 12) {
      diagnosticoAtribucion = {
        ingrediente: topCalorico.nombreOriginal,
        porcentaje: pctCalorias,
        mensaje: `El ${pctCalorias}% de tus calorías totales provino de platos con "${topCalorico.nombreOriginal}".`
      };
    }
  }

  // 7. Comparativa Fin de semana vs Días de semana
  const diasSemanaLaboral = diasRegistrados.filter((d) => !d.esFinDeSemana);
  const diasFinSemana = diasRegistrados.filter((d) => d.esFinDeSemana);

  const promSemana = diasSemanaLaboral.length
    ? Math.round(diasSemanaLaboral.reduce((acc, d) => acc + d.calorias, 0) / diasSemanaLaboral.length)
    : 0;
  const promFinSemana = diasFinSemana.length
    ? Math.round(diasFinSemana.reduce((acc, d) => acc + d.calorias, 0) / diasFinSemana.length)
    : 0;

  const diferenciaFinde = promFinSemana > 0 && promSemana > 0 ? promFinSemana - promSemana : 0;

  // 8. Proyección y Ajuste Adaptativo
  let mensajeProyeccion = null;
  if (objetivoTipo === "bajar" && diasRegistrados.length >= 3) {
    const deficitDiarioMedio = Math.round(diasRegistrados.reduce((acc, d) => acc + (tdeeUsuario - d.calorias), 0) / diasRegistrados.length);
    if (deficitDiarioMedio > 100) {
      const kgPorMes = ((deficitDiarioMedio * 30) / 7700).toFixed(1);
      mensajeProyeccion = `A este ritmo proyectas una pérdida de aprox. ${kgPorMes} kg/mes de forma saludable.`;
    }
  } else if (objetivoTipo === "subir" && diasRegistrados.length >= 3) {
    const superavitDiarioMedio = Math.round(diasRegistrados.reduce((acc, d) => acc + (d.calorias - tdeeUsuario), 0) / diasRegistrados.length);
    if (superavitDiarioMedio > 100) {
      const kgPorMes = ((superavitDiarioMedio * 30) / 7700).toFixed(1);
      mensajeProyeccion = `A este ritmo proyectas una ganancia controlada de aprox. ${kgPorMes} kg/mes.`;
    }
  }

  return {
    dias: ultimos7Dias,
    diasRegistrados,
    totalDiasRegistrados: diasRegistrados.length,
    pisoCalorias,
    techoCalorias,
    promedioCalorias,
    promedioProteinas,
    promedioCarbos,
    promedioGrasas,
    heroInfo,
    scoreDiversidad,
    topIngredientes: listaIngredientesTop,
    sugerenciasBrecha,
    proteinasFaltantesHoy,
    caloriasRestantesHoy,
    diagnosticoAtribucion,
    mensajeProyeccion,
    contextoFinde: {
      promSemana,
      promFinSemana,
      diferencia: diferenciaFinde
    }
  };
}

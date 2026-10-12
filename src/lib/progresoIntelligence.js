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
  historialPesos = [],
  fechaReferencia = new Date(),
  ventanaDias = 7
}) {
  const objetivoTipo = perfil?.objetivo || "mantener"; // "bajar" | "subir" | "mantener"
  const tdeeUsuario = perfil?.tdee || (objetivoTipo === "bajar" ? objetivos.calorias + 400 : objetivoTipo === "subir" ? Math.max(1600, objetivos.calorias - 350) : objetivos.calorias);

  // 1. Agrupar por la ventana seleccionada
  const hoy = new Date(fechaReferencia);
  const hoyIso = fechaLocalDia(hoy);
  const ultimos7Dias = Array.from({ length: ventanaDias }, (_, i) => {
    const fecha = new Date(hoy);
    fecha.setDate(hoy.getDate() - ventanaDias + 1 + i);
    const diaIso = fechaLocalDia(fecha);
    const esFinDeSemana = fecha.getDay() === 0 || fecha.getDay() === 6;
    return {
      dia: diaIso,
      fechaObj: fecha,
      esFinDeSemana,
      etiqueta: ventanaDias === 7 ? fecha.toLocaleDateString("es-AR", { weekday: "short" }).replace(".", "") : String(fecha.getDate()),
      esHoy: diaIso === hoyIso,
      calorias: 0,
      proteinas: 0,
      carbohidratos: 0,
      grasas: 0,
      fibra: 0,
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
        grupo_nutricional: ing.grupo_nutricional || "",
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
    d.tieneRegistros = d.comidas.length > 0;
    if (!d.tieneRegistros) {
      d.estado = "vacio";
      d.colorBarra = "#e5e5e3";
    } else {
      if (d.calorias < pisoCalorias) {
        d.estado = "por_debajo";
        d.colorBarra = "#64748b";
      } else if (d.calorias > techoCalorias) {
        d.estado = "por_encima";
        d.colorBarra = "#f59e0b";
      } else {
        d.estado = "en_meta";
        d.colorBarra = "#10b981";
      }
    }
  });

  const diasCompletos = ultimos7Dias.filter((d) => d.dia < hoyIso);
  const diasRegistrados = diasCompletos.filter((d) => d.tieneRegistros);
  const diasEnMeta = diasRegistrados.filter((d) => d.estado === "en_meta");
  const totalCalorias = diasRegistrados.reduce((acc, d) => acc + d.calorias, 0);
  const promedioCalorias = diasRegistrados.length ? Math.round(totalCalorias / diasRegistrados.length) : 0;
  const promedioProteinas = diasRegistrados.length ? Math.round(diasRegistrados.reduce((acc, d) => acc + d.proteinas, 0) / diasRegistrados.length) : 0;
  const promedioCarbos = diasRegistrados.length ? Math.round(diasRegistrados.reduce((acc, d) => acc + d.carbohidratos, 0) / diasRegistrados.length) : 0;
  const promedioGrasas = diasRegistrados.length ? Math.round(diasRegistrados.reduce((acc, d) => acc + d.grasas, 0) / diasRegistrados.length) : 0;

  // 3. Métrica Héroe Adaptativa según Objetivo
  let heroInfo = {};

  if (objetivoTipo === "bajar") {
    const hayDiasCompletos = diasRegistrados.length > 0;
    const diasBajo1200 = diasRegistrados.some((d) => d.calorias < 1200);
    const diasBajoBanda = diasRegistrados.some((d) => d.calorias < pisoCalorias);
    const deficitSemanalTotal = diasRegistrados.reduce((acc, d) => acc + (tdeeUsuario - d.calorias), 0);
    const deficitPromedio = diasRegistrados.length ? Math.round(deficitSemanalTotal / diasRegistrados.length) : 0;
    const gramosGrasaEstimados = Math.round((Math.max(0, deficitSemanalTotal) / 7700) * 1000); // 7700 kcal ≈ 1kg grasa

    heroInfo = {
      tipo: "bajar",
      tituloHéroe: "Déficit acumulado",
      valorPrincipal: hayDiasCompletos ? `${deficitSemanalTotal > 0 ? "-" : "+"}${Math.abs(deficitSemanalTotal).toLocaleString()}` : "—",
      unidadPrincipal: "kcal esta semana",
      subtitulo: hayDiasCompletos ? `${diasEnMeta.length} de ${diasRegistrados.length} días en banda objetivo (${pisoCalorias}–${techoCalorias} kcal)` : "Aún no hay días completos para estimar tu ritmo.",
      badgeTexto: !hayDiasCompletos ? "Sin datos" : diasBajo1200 ? "Revisar ingesta" : deficitPromedio >= 250 ? "Ritmo sostenido" : deficitPromedio > 0 ? "Déficit moderado" : "Sin déficit",
      badgeTipo: !hayDiasCompletos ? "neutro" : diasBajo1200 ? "alerta" : deficitPromedio >= 250 ? "exito" : "aviso",
      detalleRitmo: !hayDiasCompletos
        ? "Los días en curso se evalúan al completarse."
        : deficitSemanalTotal > 0
        ? `Equivale a aprox. ${gramosGrasaEstimados}g de grasa corporal movilizada esta semana.`
        : "Esta semana el balance neto fue en equilibrio o superávit.",
      avisoPiso: diasBajo1200
        ? "Hay días por debajo de 1200 kcal. Cuidá no restringir de más para preservar tu masa muscular."
        : diasBajoBanda
        ? `Hay días por debajo de tu banda objetivo (${pisoCalorias} kcal).`
        : null
    };
  } else if (objetivoTipo === "subir") {
    const superavitSemanal = diasRegistrados.reduce((acc, d) => acc + (d.calorias - tdeeUsuario), 0);
    const cumplimientoProt = objetivos.proteinas > 0 ? Math.round((promedioProteinas / objetivos.proteinas) * 100) : 100;
    const hayDiasCompletos = diasRegistrados.length > 0;
    const diasConSuperavit = diasRegistrados.filter((d) => d.calorias > tdeeUsuario).length;
    const diasBajoBanda = diasRegistrados.some((d) => d.calorias < pisoCalorias);

    heroInfo = {
      tipo: "subir",
      tituloHéroe: "Proteína y Superávit",
      valorPrincipal: hayDiasCompletos ? `${promedioProteinas}g` : "—",
      unidadPrincipal: `/ ${objetivos.proteinas}g prot diaria`,
      subtitulo: hayDiasCompletos ? `${cumplimientoProt}% de tu meta de proteína · ${diasConSuperavit} de ${diasRegistrados.length} días sobre tu gasto estimado` : "Aún no hay días completos para evaluar tu objetivo.",
      badgeTexto: !hayDiasCompletos ? "Sin datos" : cumplimientoProt >= 95 ? "Proteína en objetivo" : "Revisar proteína",
      badgeTipo: !hayDiasCompletos ? "neutro" : cumplimientoProt >= 95 ? "exito" : "alerta",
      detalleRitmo: hayDiasCompletos ? `Balance energético neto: ${superavitSemanal > 0 ? "+" : ""}${superavitSemanal} kcal esta semana.` : "Los días en curso se evalúan al completarse.",
      avisoPiso: diasBajoBanda
        ? `Hay días por debajo de la banda energética para tu objetivo (${pisoCalorias} kcal).`
        : null
    };
  } else {
    // Mantener peso
    const desviacionPromedio = diasRegistrados.length
      ? Math.round(diasRegistrados.reduce((acc, d) => acc + Math.abs(d.calorias - objetivos.calorias), 0) / diasRegistrados.length)
      : 0;
    const proporcionEnMeta = diasRegistrados.length ? diasEnMeta.length / diasRegistrados.length : null;
    const etiquetaEstabilidad = proporcionEnMeta === null
      ? "Aún sin datos suficientes"
      : proporcionEnMeta >= 0.7
      ? "Estable"
      : proporcionEnMeta >= 0.4
      ? "Variable"
      : "Irregular";

    heroInfo = {
      tipo: "mantener",
      tituloHéroe: "Estabilidad Energética",
      valorPrincipal: diasRegistrados.length ? `${diasEnMeta.length} / ${diasRegistrados.length}` : "—",
      unidadPrincipal: "días en rango",
      subtitulo: diasRegistrados.length ? `Desviación promedio de ±${desviacionPromedio} kcal frente a tu meta de ${objetivos.calorias} kcal` : "Aún no hay días completos para evaluar tu estabilidad.",
      badgeTexto: etiquetaEstabilidad,
      badgeTipo: etiquetaEstabilidad === "Estable" ? "exito" : etiquetaEstabilidad === "Irregular" ? "alerta" : "neutro",
      detalleRitmo: diasRegistrados.length ? `Promedio diario: ${promedioCalorias} kcal (Meta: ${objetivos.calorias} kcal).` : "Los días en curso se evalúan al completarse.",
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
        carbohidratosTotales: 0,
        grasasTotales: 0,
        pesosTotales: 0
      };
    }
    conteoIngredientes[nombreNorm].veces += 1;
    conteoIngredientes[nombreNorm].caloriasTotales += ing.calorias;
    conteoIngredientes[nombreNorm].proteinasTotales += ing.proteinas_g;
    conteoIngredientes[nombreNorm].carbohidratosTotales += ing.carbohidratos_g;
    conteoIngredientes[nombreNorm].grasasTotales += ing.grasas_g;
    conteoIngredientes[nombreNorm].pesosTotales += ing.peso_g;
  });

  const noMostrarEnRanking = (nombre) => /aceite|manteca|margarina|mayonesa|sal\b|pimienta|oregano|orégano|condimento|vinagre|ajo en polvo/.test(nombre);
  const categorizarIngrediente = (nombre) => {
    if (/cerveza|vino|whisky|vodka|fernet|gin|ron|licor|alcohol/.test(nombre)) return "alcohol";
    if (/galleta|alfajor|gaseosa|snack|papas fritas|chocolate|dulce|factura|ultraproces/.test(nombre)) return "ultraprocesados";
    if (/lechuga|tomate|pepino|zanahoria|brocoli|brócoli|espinaca|verdura|vegetal|palta|acelga|cebolla|pimiento|morron|mor(r)?ón|zapallo|calabaza/.test(nombre)) return "verduras";
    if (INGREDIENTES_PROTEICOS.some((item) => nombre.includes(normalizarTexto(item)))) return "proteinas";
    return "otros";
  };
  const listaIngredientesTop = Object.values(conteoIngredientes)
    .filter((ing) => !noMostrarEnRanking(ing.nombreNorm))
    .map((ing) => ({ ...ing, categoria: categorizarIngrediente(ing.nombreNorm) }))
    .sort((a, b) => b.veces - a.veces || b.caloriasTotales - a.caloriasTotales);

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
  const grasasRestantesHoy = Math.max(0, objetivos.grasas - (diaHoy?.grasas || 0));
  const carbohidratosRestantesHoy = Math.max(0, objetivos.carbohidratos - (diaHoy?.carbohidratos || 0));
  const proteicosHabituales = Object.values(conteoIngredientes).filter((ing) => INGREDIENTES_PROTEICOS.some((p) => ing.nombreNorm.includes(normalizarTexto(p))) && ing.pesosTotales > 0 && ing.proteinasTotales > 0);
  const sugerenciasBrecha = [];
  if (proteinasFaltantesHoy > 15) {
    const candidatos = proteicosHabituales.map((ing) => ({
      nombre: ing.nombreOriginal,
      proteina100: ing.proteinasTotales / ing.pesosTotales * 100,
      carbo100: ing.carbohidratosTotales / ing.pesosTotales * 100,
      kcal100: ing.caloriasTotales / ing.pesosTotales * 100,
      grasa100: ing.grasasTotales / ing.pesosTotales * 100,
      veces: ing.veces
    })).filter((ing) => Number.isFinite(ing.proteina100) && ing.proteina100 > 0 && ing.kcal100 > 0 && ing.grasa100 >= 0)
      .sort((a, b) => b.veces - a.veces || b.proteina100 - a.proteina100);
    const dimensionar = (candidato, objetivoProteina) => {
      const limites = [objetivoProteina / candidato.proteina100 * 100, 250];
      if (candidato.kcal100 > 0) limites.push(caloriasRestantesHoy / candidato.kcal100 * 100);
      if (candidato.grasa100 > 0) limites.push(grasasRestantesHoy / candidato.grasa100 * 100);
      if (candidato.carbo100 > 0) limites.push(carbohidratosRestantesHoy / candidato.carbo100 * 100);
      const gramos = Math.floor(Math.min(...limites));
      if (gramos < 20) return null;
      const caloriasReales = candidato.kcal100 * gramos / 100;
      const proteinasReales = candidato.proteina100 * gramos / 100;
      const grasasReales = candidato.grasa100 * gramos / 100;
      const carbohidratosReales = (candidato.carbo100 || 0) * gramos / 100;
      return { nombre: candidato.nombre, gramos, calorias: Math.floor(caloriasReales), proteinas: Math.floor(proteinasReales), grasas: Math.floor(grasasReales), carbohidratos: Math.floor(carbohidratosReales), caloriasReales, proteinasReales, grasasReales, carbohidratosReales };
    };
    candidatos.forEach((candidato) => {
      const porcion = dimensionar(candidato, proteinasFaltantesHoy);
      if (porcion) sugerenciasBrecha.push({ titulo: `${porcion.gramos} g de ${porcion.nombre}`, componentes: [porcion], calorias: porcion.calorias, proteinas: porcion.proteinas, grasas: porcion.grasas, carbohidratos: porcion.carbohidratos, motivo: "Alimento proteico habitual que cabe en tus objetivos restantes" });
    });
    if (candidatos.length > 1) {
      const porciones = candidatos.slice(0, 2).map((item) => dimensionar(item, proteinasFaltantesHoy / 2));
      const combinacion = porciones.filter(Boolean);
      const kcalReales = combinacion.reduce((s, p) => s + p.caloriasReales, 0), grasaReal = combinacion.reduce((s, p) => s + p.grasasReales, 0), carbosReales = combinacion.reduce((s, p) => s + p.carbohidratosReales, 0);
      if (combinacion.length === 2 && kcalReales <= caloriasRestantesHoy && grasaReal <= grasasRestantesHoy && carbosReales <= carbohidratosRestantesHoy) sugerenciasBrecha.unshift({ titulo: combinacion.map((p) => `${p.gramos} g de ${p.nombre}`).join(" + "), componentes: combinacion, calorias: Math.floor(kcalReales), proteinas: combinacion.reduce((s, p) => s + p.proteinas, 0), grasas: Math.floor(grasaReal), carbohidratos: Math.floor(carbosReales), motivo: "Combinación de alimentos habituales dentro de tus objetivos restantes" });
    }
    sugerenciasBrecha.splice(5);
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
  const comparativaFindeDisponible = diasFinSemana.length >= 2 && diasSemanaLaboral.length > 0;

  const promSemana = comparativaFindeDisponible
    ? Math.round(diasSemanaLaboral.reduce((acc, d) => acc + d.calorias, 0) / diasSemanaLaboral.length)
    : 0;
  const promFinSemana = comparativaFindeDisponible
    ? Math.round(diasFinSemana.reduce((acc, d) => acc + d.calorias, 0) / diasFinSemana.length)
    : 0;

  const diferenciaFinde = promFinSemana > 0 && promSemana > 0 ? promFinSemana - promSemana : 0;

  // 8. Proyección y Ajuste Adaptativo
  let mensajeProyeccion = null;
  if (objetivoTipo === "bajar" && diasRegistrados.length >= 3) {
    const deficitDiarioMedio = Math.round(diasRegistrados.reduce((acc, d) => acc + (tdeeUsuario - d.calorias), 0) / diasRegistrados.length);
    if (deficitDiarioMedio > 100) {
      const kgPorMes = ((deficitDiarioMedio * 30) / 7700).toFixed(1);
      mensajeProyeccion = `Con el déficit medio registrado, la proyección sería de aprox. ${kgPorMes} kg/mes.`;
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
    totalDiasCompletos: diasCompletos.length,
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
    grasasRestantesHoy,
    carbohidratosRestantesHoy,
    diagnosticoAtribucion,
    mensajeProyeccion,
    contextoFinde: {
      datosSuficientes: comparativaFindeDisponible,
      promSemana,
      promFinSemana,
      diferencia: diferenciaFinde
    }
  };
}

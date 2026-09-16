/**
 * Cálculos metabólicos basados en la fórmula Mifflin-St Jeor,
 * TDEE y reparto fisiológico de macronutrientes.
 */

export const FACTORES_ACTIVIDAD = {
  sedentario: {
    factor: 1.2,
    etiqueta: "Sedentario",
    descripcion: "Poco o nada de ejercicio, trabajo de escritorio",
    proteinaGPorKg: 1.2
  },
  ligero: {
    factor: 1.375,
    etiqueta: "Ligero",
    descripcion: "Ejercicio ligero 1 a 3 días por semana",
    proteinaGPorKg: 1.6
  },
  moderado: {
    factor: 1.55,
    etiqueta: "Moderado",
    descripcion: "Ejercicio moderado 3 a 5 días por semana",
    proteinaGPorKg: 1.8
  },
  intenso: {
    factor: 1.725,
    etiqueta: "Intenso",
    descripcion: "Ejercicio intenso 6 a 7 días por semana",
    proteinaGPorKg: 2.0
  },
  muy_intenso: {
    factor: 1.9,
    etiqueta: "Muy intenso",
    descripcion: "Atleta o trabajo físico pesado + entrenamiento",
    proteinaGPorKg: 2.2
  }
};

export const OBJETIVOS_CALORICOS = {
  mantener: {
    etiqueta: "Mantener peso",
    ajusteKcal: 0,
    descripcion: "Balance energético neutro (consumo igual a gasto)"
  },
  bajar: {
    etiqueta: "Bajar de peso (Déficit)",
    ajusteKcal: -400,
    descripcion: "Déficit calórico moderado y sostenible (~0.4 kg/sem)"
  },
  subir: {
    etiqueta: "Subir de peso (Superávit)",
    ajusteKcal: 350,
    descripcion: "Superávit calórico controlado para ganancia muscular"
  }
};

/**
 * Calcula la edad exacta en años a partir de la fecha de nacimiento (YYYY-MM-DD).
 */
export function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return 30; // Valor de referencia por defecto
  const hoy = new Date();
  const nacimiento = new Date(fechaNacimiento + "T00:00:00");
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const mesDiff = hoy.getMonth() - nacimiento.getMonth();
  if (mesDiff < 0 || (mesDiff === 0 && hoy.getDate() < nacimiento.getDate())) {
    edad--;
  }
  return Math.max(10, Math.min(110, edad));
}

/**
 * Calcula el Índice de Masa Corporal (IMC).
 */
export function calcularIMC(pesoKg, alturaCm) {
  if (!pesoKg || !alturaCm) return null;
  const alturaM = alturaCm / 100;
  const imc = pesoKg / (alturaM * alturaM);
  return Number(imc.toFixed(1));
}

export function clasificarIMC(imc) {
  if (!imc) return "";
  if (imc < 18.5) return "Bajo peso";
  if (imc < 25) return "Normal";
  if (imc < 30) return "Sobrepeso";
  return "Obesidad";
}

/**
 * Calcula la Tasa Metabólica Basal (TMB) con la fórmula de Mifflin-St Jeor.
 * Hombres: 10 * peso(kg) + 6.25 * altura(cm) - 5 * edad + 5
 * Mujeres: 10 * peso(kg) + 6.25 * altura(cm) - 5 * edad - 161
 */
export function calcularTMB({ pesoKg, alturaCm, edad, sexo = "masculino" }) {
  if (!pesoKg || !alturaCm || !edad) return 1600;
  const base = 10 * pesoKg + 6.25 * alturaCm - 5 * edad;
  const constante = sexo === "femenino" ? -161 : 5;
  return Math.round(base + constante);
}

/**
 * Calcula el Gasto Energético Total Diario (TDEE).
 */
export function calcularTDEE(tmb, nivelActividad = "moderado") {
  const cfg = FACTORES_ACTIVIDAD[nivelActividad] || FACTORES_ACTIVIDAD.moderado;
  return Math.round(tmb * cfg.factor);
}

/**
 * Realiza el cálculo integral de objetivos diarios nutricionales.
 * 
 * Reglas:
 * 1. Proteínas: calculadas por kg de peso (1.2 a 2.0 g/kg según nivel de actividad).
 * 2. Grasas: 25% de las calorías totales (mínimo de salud hormonal ~0.8g/kg).
 * 3. Carbohidratos: calorías restantes divididas por 4.
 */
export function calcularObjetivosNutricionales(perfil = {}, pesoActual = 75) {
  const peso = Number(pesoActual) || 75;
  const altura = Number(perfil.altura_cm) || 175;
  const edad = calcularEdad(perfil.fecha_nacimiento);
  const sexo = perfil.sexo || "masculino";
  const actividadKey = perfil.nivel_actividad || "moderado";
  const objetivoKey = perfil.objetivo || "mantener";

  const tmb = calcularTMB({ pesoKg: peso, alturaCm: altura, edad, sexo });
  const tdee = calcularTDEE(tmb, actividadKey);

  const configActividad = FACTORES_ACTIVIDAD[actividadKey] || FACTORES_ACTIVIDAD.moderado;
  const configObjetivo = OBJETIVOS_CALORICOS[objetivoKey] || OBJETIVOS_CALORICOS.mantener;

  // Calorías diarias ajustadas por objetivo
  const caloriasTotales = Math.max(1200, Math.round(tdee + configObjetivo.ajusteKcal));

  // 1. Proteínas
  const factorProt = configActividad.proteinaGPorKg;
  const proteinasG = Math.round(peso * factorProt);
  const caloriasProt = proteinasG * 4;

  // 2. Grasas (25% de calorías totales, mínimo 0.8g/kg)
  const caloriasGrasasObjetivo = caloriasTotales * 0.25;
  const grasasPorCalorias = Math.round(caloriasGrasasObjetivo / 9);
  const grasasMinimas = Math.round(peso * 0.8);
  const grasasG = Math.max(grasasMinimas, grasasPorCalorias);
  const caloriasGrasas = grasasG * 9;

  // 3. Carbohidratos (lo que queda)
  const caloriasRestantes = caloriasTotales - caloriasProt - caloriasGrasas;
  const carbohidratosG = Math.max(20, Math.round(caloriasRestantes / 4));

  return {
    peso,
    altura,
    edad,
    tmb,
    tdee,
    calorias: caloriasTotales,
    proteinas: proteinasG,
    carbohidratos: carbohidratosG,
    grasas: grasasG,
    desgloseCalorias: {
      proteinasKcal: caloriasProt,
      carbohidratosKcal: carbohidratosG * 4,
      grasasKcal: caloriasGrasas
    },
    porcentajes: {
      proteinas: Math.round((caloriasProt / caloriasTotales) * 100),
      carbohidratos: Math.round(((carbohidratosG * 4) / caloriasTotales) * 100),
      grasas: Math.round((caloriasGrasas / caloriasTotales) * 100)
    }
  };
}

export function fechaLocalDia(fechaIso) {
  const fecha = new Date(fechaIso);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}

export function agruparPorDia(comidas) {
  const grupos = comidas.reduce((resultado, comida) => {
    const dia = fechaLocalDia(comida.fecha);
    (resultado[dia] ??= []).push(comida);
    return resultado;
  }, {});

  return Object.entries(grupos).sort(([a], [b]) => b.localeCompare(a));
}

export function formatoHora(fechaIso) {
  return new Date(fechaIso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

export function formatoDia(dia) {
  const texto = new Date(`${dia}T12:00:00`).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function formatoDiaCorto(dia) {
  return new Date(`${dia}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

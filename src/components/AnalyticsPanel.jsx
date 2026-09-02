import { useMemo } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fechaLocalDia } from "../lib/date";

export function AnalyticsPanel({ comidas, objetivos, onVerHistorial }) {
  const semana = useMemo(() => {
    const hoy = new Date();
    return Array.from({ length: 7 }, (_, indice) => {
      const fecha = new Date(hoy); fecha.setDate(hoy.getDate() - 6 + indice);
      const dia = fechaLocalDia(fecha);
      return { dia, etiqueta: fecha.toLocaleDateString("es-AR", { weekday: "short" }).replace(".", ""), calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 };
    });
  }, []);
  const dias = useMemo(() => {
    const porDia = comidas.reduce((resultado, comida) => {
      const dia = fechaLocalDia(comida.fecha);
      const actual = resultado[dia] ??= { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 };
      actual.calorias += Number(comida.calorias_totales || 0); actual.proteinas += Number(comida.proteinas_totales_g || 0); actual.carbohidratos += Number(comida.carbohidratos_totales_g || 0); actual.grasas += Number(comida.grasas_totales_g || 0);
      return resultado;
    }, {});
    return semana.map((dia) => ({ ...dia, ...porDia[dia.dia] }));
  }, [comidas, semana]);
  const registrados = dias.filter((dia) => dia.calorias > 0);
  const promedio = registrados.length ? Math.round(registrados.reduce((total, dia) => total + dia.calorias, 0) / registrados.length) : 0;
  const adherencia = registrados.length ? Math.round(registrados.filter((dia) => dia.calorias >= objetivos.calorias * 0.8 && dia.calorias <= objetivos.calorias * 1.1).length / registrados.length * 100) : 0;
  const macros = [
    { etiqueta: "Proteína", valor: promedioMacro("proteinas"), objetivo: objetivos.proteinas },
    { etiqueta: "Carbohidratos", valor: promedioMacro("carbohidratos"), objetivo: objetivos.carbohidratos },
    { etiqueta: "Grasas", valor: promedioMacro("grasas"), objetivo: objetivos.grasas },
  ];
  function promedioMacro(campo) { return registrados.length ? Math.round(registrados.reduce((total, dia) => total + dia[campo], 0) / registrados.length) : 0; }
  const tooltip = { background: "#fff", border: "1px solid #e9e9e7", borderRadius: 10, fontSize: 12 };

  return <section className="insights"><div className="insight-heading"><span>Esta semana</span><h2>Tu progreso</h2></div><div className="insight-summary"><div><small>Promedio diario</small><strong>{promedio}<em> kcal</em></strong><span>Meta: {objetivos.calorias} kcal</span></div><div className="consistency"><b>{registrados.length}<small>/ 7</small></b><span>Días registrados</span></div></div><div className="insight-card trend-card"><div className="card-heading"><div><h3>Ingesta diaria</h3><span>{registrados.length >= 3 ? "Últimos 7 días" : "Empezá a descubrir tu patrón"}</span></div><b>{adherencia}%<small> en meta</small></b></div><div className="weekly-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={dias} barCategoryGap="30%"><XAxis dataKey="etiqueta" tick={{ fontSize: 10, fill: "#8b8b8b" }} axisLine={false} tickLine={false} /><YAxis hide domain={[0, "dataMax + 300"]} /><Tooltip contentStyle={tooltip} formatter={(valor) => [`${valor} kcal`, "Calorías"]} cursor={{ fill: "#f5f5f3" }} /><Bar dataKey="calorias" fill="#171717" radius={[6, 6, 2, 2]} /></BarChart></ResponsiveContainer></div><p className="chart-goal"><i /> Objetivo diario: {objetivos.calorias} kcal</p></div><div className="insight-card macro-card"><div className="card-heading"><div><h3>Balance nutricional</h3><span>Promedio por día registrado</span></div></div>{macros.map((macro) => <MacroProgress key={macro.etiqueta} {...macro} />)}</div>{registrados.length < 3 && <div className="insight-tip"><b>✦</b><p><strong>Recién empezamos.</strong> Registrá tus comidas durante algunos días para ver tendencias y recomendaciones más precisas.</p></div>}<button className="historical-link" onClick={onVerHistorial}><span>▣</span><div><strong>Historial completo</strong><small>Todos tus registros y comidas</small></div><b>›</b></button></section>;
}

function MacroProgress({ etiqueta, valor, objetivo }) {
  const porcentaje = Math.min(100, Math.round((valor / objetivo) * 100));
  return <div className="macro-progress"><div><span>{etiqueta}</span><b>{valor}<small> / {objetivo}g</small></b></div><i><b style={{ width: `${porcentaje}%` }} /></i><small>{porcentaje}% del objetivo</small></div>;
}

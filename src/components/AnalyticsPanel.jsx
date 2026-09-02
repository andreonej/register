import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fechaLocalDia, formatoDiaCorto } from "../lib/date";

export function AnalyticsPanel({ comidas }) {
  const dias = useMemo(() => Object.values(comidas.reduce((resultado, comida) => {
    const dia = fechaLocalDia(comida.fecha);
    const actual = resultado[dia] ??= { dia, calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, ingredientes: 0, estimados: 0 };
    actual.calorias += Number(comida.calorias_totales || 0); actual.proteinas += Number(comida.proteinas_totales_g || 0); actual.carbohidratos += Number(comida.carbohidratos_totales_g || 0); actual.grasas += Number(comida.grasas_totales_g || 0);
    (comida.comida_ingredientes || []).forEach((ingrediente) => { actual.ingredientes += 1; if (ingrediente.supuesto) actual.estimados += 1; });
    return resultado;
  }, {})).sort((a, b) => a.dia.localeCompare(b.dia)).slice(-14).map((dia) => ({ ...dia, etiqueta: formatoDiaCorto(dia.dia) })), [comidas]);
  if (!comidas.length) return <p className="empty-state">Todavía no hay datos para mostrar evolución.</p>;
  const promedio = Math.round(dias.reduce((total, dia) => total + dia.calorias, 0) / dias.length);
  const ingredientes = dias.reduce((total, dia) => total + dia.ingredientes, 0);
  const estimados = dias.reduce((total, dia) => total + dia.estimados, 0);
  const tooltip = { background: "#fff", border: "1px solid #ebe9e2", borderRadius: 8, fontSize: 12 };
  return <section className="analytics"><div className="metrics"><Metric etiqueta="Promedio diario" valor={`${promedio} kcal`} sub={`${dias.length} días`} /><Metric etiqueta="Datos estimados" valor={`${ingredientes ? Math.round(estimados / ingredientes * 100) : 0}%`} sub={`${estimados} de ${ingredientes} ítems`} /></div><Chart titulo="Calorías por día"><LineChart data={dias}><ChartBase /><Line type="monotone" dataKey="calorias" stroke="#d4a14b" strokeWidth={3} dot={{ r: 3 }} /></LineChart></Chart><Chart titulo="Macronutrientes por día (g)"><BarChart data={dias}><ChartBase /><Bar dataKey="proteinas" stackId="a" fill="#c45a4a" /><Bar dataKey="carbohidratos" stackId="a" fill="#d4a14b" /><Bar dataKey="grasas" stackId="a" fill="#7c9a7a" radius={[3, 3, 0, 0]} /></BarChart></Chart><p className="legend">● Proteínas &nbsp; ● Carbohidratos &nbsp; ● Grasas</p></section>;
  function ChartBase() { return <><CartesianGrid stroke="#ebe9e2" vertical={false} /><XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={40} /><Tooltip contentStyle={tooltip} /></>; }
}
function Metric({ etiqueta, valor, sub }) { return <div className="metric"><small>{etiqueta}</small><strong>{valor}</strong><small>{sub}</small></div>; }
function Chart({ titulo, children }) { return <div><p className="chart-title">{titulo}</p><div className="chart"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div></div>; }

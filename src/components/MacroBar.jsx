export const COLORES_MACROS = {
  proteinas: "#2563eb",
  carbohidratos: "#7c3aed",
  grasas: "#d97706"
};

export function MacroRing({ etiqueta, valor, maximo, unidad = "g", color = "#171717" }) {
  const excedido = maximo > 0 && valor > maximo;
  const porcentaje = Math.min(100, maximo ? (valor / maximo) * 100 : 0);
  const colorAnillo = excedido ? "#e36a3f" : color;
  return <div className={`macro-ring${excedido ? " exceeded" : ""}`}><i style={{ background: `conic-gradient(${colorAnillo} ${porcentaje}%, #e8e8e8 0)` }}><b>{Math.round(valor)}<small>/{Math.round(maximo)}{unidad}</small></b></i><span>{etiqueta}</span></div>;
}

export const COLORES_MACROS = {
  proteinas: "#2563eb",
  carbohidratos: "#7c3aed",
  grasas: "#d97706"
};

export function MacroRing({ etiqueta, valor, maximo, unidad = "g", color = "#171717" }) {
  const porcentaje = Math.min(100, maximo ? (valor / maximo) * 100 : 0);
  return <div className="macro-ring"><i style={{ background: `conic-gradient(${color} ${porcentaje}%, #e8e8e8 0)` }}><b>{Math.round(valor)}<small>{unidad}</small></b></i><span>{etiqueta}</span></div>;
}

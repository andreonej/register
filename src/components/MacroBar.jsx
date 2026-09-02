export function MacroRing({ etiqueta, valor, maximo, unidad = "g" }) {
  const porcentaje = Math.min(100, maximo ? (valor / maximo) * 100 : 0);
  return <div className="macro-ring"><i style={{ background: `conic-gradient(#171717 ${porcentaje}%, #e8e8e8 0)` }}><b>{Math.round(valor)}<small>{unidad}</small></b></i><span>{etiqueta}</span></div>;
}

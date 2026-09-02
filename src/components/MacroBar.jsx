export function MacroBar({ etiqueta, valor, maximo, color }) {
  const porcentaje = maximo ? Math.min(100, (valor / maximo) * 100) : 0;
  return <div className="macro-bar"><div><span>{etiqueta}</span><strong>{Math.round(valor)}g</strong></div><i><b style={{ width: `${porcentaje}%`, background: color }} /></i></div>;
}

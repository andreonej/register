import { formatoHora } from "../lib/date";

export function MealRow({ comida, abierta, confirmando, onToggle, onConfirmar, onCancelar, onBorrar }) {
  const ingredientes = comida.comida_ingredientes || [];
  const estimada = ingredientes.some((ingrediente) => ingrediente.supuesto);
  return <article className="meal-card"><div className="meal-head"><div className="meal-icon">♨</div><button className="meal-main" onClick={onToggle} aria-expanded={abierta}><span><strong>{comida.comida_nombre}</strong><small>{formatoHora(comida.fecha)} {estimada && "· estimado"}</small><em>P {Math.round(comida.proteinas_totales_g || 0)}g &nbsp; C {Math.round(comida.carbohidratos_totales_g || 0)}g &nbsp; G {Math.round(comida.grasas_totales_g || 0)}g</em></span></button><div className="meal-meta"><b>{Math.round(comida.calorias_totales)}<small> kcal</small></b>{confirmando ? <div className="delete-confirm"><button onClick={onBorrar}>Borrar</button><button onClick={onCancelar}>No</button></div> : <button className="delete-button" onClick={onConfirmar} aria-label="Borrar registro">×</button>}</div></div>{abierta && <div className="ingredients">{ingredientes.map((ingrediente) => <div key={ingrediente.id}><span>{ingrediente.nombre}{ingrediente.supuesto && " *"}</span><span>{ingrediente.peso_estimado_g}g · {Math.round(ingrediente.calorias)} kcal</span></div>)}</div>}</article>;
}

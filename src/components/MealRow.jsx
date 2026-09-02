import { formatoHora } from "../lib/date";

export function MealRow({ comida, abierta, confirmando, onToggle, onConfirmar, onCancelar, onBorrar }) {
  const ingredientes = comida.comida_ingredientes || [];
  const estimada = ingredientes.some((ingrediente) => ingrediente.supuesto);
  return <article className="meal-card">
    <div className="meal-head">
      <button className="meal-main" onClick={onToggle} aria-expanded={abierta}>
        <time>{formatoHora(comida.fecha)}</time><span><strong>{comida.comida_nombre}</strong><small>{Math.round(comida.calorias_totales)} kcal {estimada && "· estimado"}</small></span>
      </button>
      {confirmando ? <div className="delete-confirm"><span>¿Borrar?</span><button onClick={onBorrar}>Sí</button><button onClick={onCancelar}>No</button></div> : <button className="delete-button" onClick={onConfirmar} aria-label="Borrar registro">×</button>}
    </div>
    {abierta && <div className="ingredients">{ingredientes.map((ingrediente) => <div key={ingrediente.id}><span>{ingrediente.nombre}{ingrediente.supuesto && " *"}</span><span>{ingrediente.peso_estimado_g}g · {Math.round(ingrediente.calorias)} kcal</span></div>)}</div>}
  </article>;
}

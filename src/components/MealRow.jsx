import { useEffect, useState } from "react";
import { formatoHora } from "../lib/date";
import { MealIcon } from "./MealIcon";
import { obtenerUrlFotoComida } from "../services/fotos";

function redondear(valor, decimales = 2) {
  const precision = 10 ** decimales;
  return Math.round((Number(valor) + Number.EPSILON) * precision) / precision;
}

export function MealRow({ comida, abierta, confirmando, onToggle, onConfirmar, onCancelar, onBorrar, onEditar, onGuardarEdicion }) {
  const [editando, setEditando] = useState(false);
  const [ingredientesEditados, setIngredientesEditados] = useState(comida.comida_ingredientes || []);
  useEffect(() => { setIngredientesEditados(comida.comida_ingredientes || []); }, [comida]);
  const ingredientes = comida.comida_ingredientes || [];
  const estimada = ingredientes.some((ingrediente) => ingrediente.supuesto);

  function actualizarCampo(indice, campo, valor) {
    setIngredientesEditados((actuales) =>
      actuales.map((item, i) => i === indice ? { ...item, [campo]: valor } : item)
    );
  }

  function cambiarCantidad(indice, nuevaCantidad) {
    setIngredientesEditados((actuales) =>
      actuales.map((item, i) => {
        if (i !== indice) return item;
        const cantidadAnterior = Math.max(1, Number(item.cantidad) || 1);
        const cantidadNueva = Math.max(1, Math.round(Number(nuevaCantidad) || 1));
        const escala = cantidadNueva / cantidadAnterior;
        return {
          ...item,
          cantidad: cantidadNueva,
          peso_estimado_g: redondear(Number(item.peso_estimado_g || 0) * escala),
          calorias: redondear(Number(item.calorias || 0) * escala),
          proteinas_g: redondear(Number(item.proteinas_g || 0) * escala),
          carbohidratos_g: redondear(Number(item.carbohidratos_g || 0) * escala),
          grasas_g: redondear(Number(item.grasas_g || 0) * escala),
        };
      })
    );
  }

  return (
    <>
      <article className="meal-card" id={`comida-${comida.id}`} onTouchStart={(event) => { event.currentTarget.dataset.touchX = event.touches[0].clientX; }} onTouchEnd={(event) => { const delta = event.changedTouches[0].clientX - Number(event.currentTarget.dataset.touchX || 0); if (Math.abs(delta) > 80) { event.preventDefault(); delta < 0 ? onBorrar() : onEditar(); } }}>
        <div className="meal-head">
          <div className="meal-icon" title={comida.comida_nombre}>
            {comida.foto_path ? <img src={obtenerUrlFotoComida(comida.foto_path)} alt="" loading="lazy" /> :
            <MealIcon ingredientes={ingredientes} name={comida.comida_nombre} size={22} color="var(--ink)" />
            }
          </div>
          <button className="meal-main" onClick={onToggle} aria-expanded={abierta}>
            <span>
              <strong onClick={onToggle}>{comida.comida_nombre}</strong>
              <small>{formatoHora(comida.fecha)} {estimada && "· estimado"}</small>
              <em>P {Math.round(comida.proteinas_totales_g || 0)}g &nbsp; C {Math.round(comida.carbohidratos_totales_g || 0)}g &nbsp; G {Math.round(comida.grasas_totales_g || 0)}g</em>
            </span>
          </button>
          <div className="meal-meta">
            <b>{Math.round(comida.calorias_totales)}<small> kcal</small></b>
              <button className="delete-button" onClick={onConfirmar} aria-label={`Opciones para ${comida.comida_nombre}`} aria-expanded={confirmando}>•••</button>
          </div>
        </div>
        {abierta && (
          <div className={`ingredients ${editando ? "editing" : ""}`}>
            <button className="meal-edit-action" onClick={() => setEditando((valor) => !valor)}>{editando ? "Cancelar edición" : "Editar ingredientes"}</button>
            {comida.foto_path && (
              <img
                className="meal-photo"
                src={obtenerUrlFotoComida(comida.foto_path)}
                alt={`Foto de ${comida.comida_nombre}`}
                loading="lazy"
              />
            )}
            {(editando ? ingredientesEditados : ingredientes).map((ingrediente, indice) => (
              <div key={ingrediente.id || indice} className={editando ? "ingredient-edit-card" : "ingredient-row"}>
                {editando ? (
                  <>
                    <div className="ingredient-edit-top">
                      <span className="ingredient-edit-name">{ingrediente.nombre}{ingrediente.supuesto && " *"}</span>
                      <div className="ingredient-edit-qty" aria-label={`Cantidad de ${ingrediente.nombre || "ingrediente"}`}>
                        <button type="button" aria-label="Restar unidad" onClick={() => cambiarCantidad(indice, (Number(ingrediente.cantidad) || 1) - 1)}>−</button>
                        <span>{Math.max(1, Number(ingrediente.cantidad) || 1)}×</span>
                        <button type="button" aria-label="Sumar unidad" onClick={() => cambiarCantidad(indice, (Number(ingrediente.cantidad) || 1) + 1)}>+</button>
                      </div>
                    </div>
                    <div className="ingredient-edit-fields">
                      {[["peso_estimado_g", "Gramos"], ["calorias", "kcal"], ["proteinas_g", "Prot"], ["carbohidratos_g", "Carb"], ["grasas_g", "Grasa"]].map(([campo, titulo]) => (
                        <label key={campo}>
                          <span>{titulo}</span>
                          <input
                            type="number"
                            min="0"
                            inputMode="decimal"
                            value={ingrediente[campo] ?? 0}
                            onChange={(event) => actualizarCampo(indice, campo, event.target.value)}
                          />
                        </label>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <span>{Number(ingrediente.cantidad) > 1 && `${ingrediente.cantidad}× `}{ingrediente.nombre}{ingrediente.supuesto && " *"}</span>
                    <span>{ingrediente.peso_estimado_g}g · {Math.round(ingrediente.calorias)} kcal</span>
                  </>
                )}
              </div>
            ))}
            {editando && <button className="meal-edit-action meal-edit-save" onClick={async () => { await onGuardarEdicion(ingredientesEditados); setEditando(false); }}>Guardar cambios</button>}
          </div>
        )}
      </article>
      {confirmando && (
        <div className="delete-sheet-backdrop" onClick={onCancelar} role="presentation">
          <section className="delete-sheet" role="dialog" aria-modal="true" aria-label={`Opciones para ${comida.comida_nombre}`} onClick={(evento) => evento.stopPropagation()}>
            <span className="sheet-handle" />
            <h2>¿Eliminar esta comida?</h2>
            <p>Se eliminar&aacute; {"\u201C"}{comida.comida_nombre}{"\u201D"} de tu registro.</p>
            <button className="delete-action" onClick={onBorrar}>Eliminar comida</button>
            <button className="cancel-action" onClick={onCancelar}>Cancelar</button>
          </section>
        </div>
      )}
    </>
  );
}

export const EJEMPLO_REGISTRO = `{
  "comida_nombre": "Ensalada de lentejas",
  "fecha": "2026-09-02 12:30",
  "ingredientes": [{ "nombre": "Lentejas cocidas", "peso_estimado_g": 150, "calorias": 170, "proteinas_g": 12, "carbohidratos_g": 28, "grasas_g": 1, "supuesto": false }],
  "totales_plato": { "calorias": 170, "proteinas_g": 12, "carbohidratos_g": 28, "grasas_g": 1 },
  "nivel_confianza": "Alto"
}`;

export function NewMealDrawer({ abierto, texto, mensaje, guardando, onTexto, onCerrar, onGuardar, onAbrir }) {
  return <div className="drawer-wrap"><div className="drawer">{abierto ? <><h2>Cargar nuevo registro</h2><textarea value={texto} onChange={(evento) => onTexto(evento.target.value)} placeholder={EJEMPLO_REGISTRO} rows="7" />{mensaje && <p className={`message ${mensaje.tipo}`}>{mensaje.texto}</p>}<div className="actions"><button onClick={onCerrar}>Cancelar</button><button className="primary" onClick={onGuardar} disabled={guardando || !texto.trim()}>{guardando ? "Guardando…" : "Guardar comida"}</button></div></> : <button className="add-button" onClick={onAbrir}>+ Cargar comida</button>}</div></div>;
}

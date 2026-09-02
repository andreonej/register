import { useEffect, useMemo, useState } from "react";
import { AnalyticsPanel } from "./components/AnalyticsPanel";
import { MacroRing } from "./components/MacroBar";
import { MealRow } from "./components/MealRow";
import { NewMealDrawer } from "./components/NewMealDrawer";
import { agruparPorDia, fechaLocalDia, formatoDia } from "./lib/date";
import { crearComida, eliminarComida, obtenerComidas } from "./services/comidas";
import "./App.css";

const OBJETIVOS = { calorias: 2000, proteinas: 130, carbohidratos: 250, grasas: 70 };
const diaIso = (fecha) => `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
const moverDia = (dia, cantidad) => { const fecha = new Date(`${dia}T12:00:00`); fecha.setDate(fecha.getDate() + cantidad); return diaIso(fecha); };
const formatoNav = (dia) => { const fecha = new Date(`${dia}T12:00:00`); return { semana: fecha.toLocaleDateString("es-AR", { weekday: "short" }).replace(".", ""), numero: fecha.getDate() }; };

export default function DiarioComidas() {
  const [comidas, setComidas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [vista, setVista] = useState("diario");
  const [diaSeleccionado, setDiaSeleccionado] = useState(() => fechaLocalDia(new Date()));
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [textoJson, setTextoJson] = useState("");
  const [mensaje, setMensaje] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [expandido, setExpandido] = useState(null);
  const [confirmandoId, setConfirmandoId] = useState(null);

  async function cargarComidas() {
    setCargando(true); setError(null);
    try { setComidas(await obtenerComidas()); } catch (err) { setError(err.message); } finally { setCargando(false); }
  }
  useEffect(() => { cargarComidas(); }, []);
  async function guardarRegistro() {
    setGuardando(true); setMensaje(null);
    try {
      const registro = JSON.parse(textoJson);
      await crearComida(registro);
      setMensaje({ tipo: "ok", texto: `Guardado: ${registro.comida_nombre}` });
      setTextoJson(""); setPanelAbierto(false); cargarComidas();
    } catch (err) { setMensaje({ tipo: "error", texto: err.message.includes("JSON") ? "El texto no es un JSON válido" : err.message }); } finally { setGuardando(false); }
  }
  async function borrarComida(id) {
    try { await eliminarComida(id); setComidas((actuales) => actuales.filter((comida) => comida.id !== id)); setConfirmandoId(null); }
    catch (err) { setError(err.message); }
  }

  const comidasDelDia = useMemo(() => comidas.filter((comida) => fechaLocalDia(comida.fecha) === diaSeleccionado), [comidas, diaSeleccionado]);
  const totales = useMemo(() => comidasDelDia.reduce((total, comida) => ({
    calorias: total.calorias + Number(comida.calorias_totales || 0), proteinas: total.proteinas + Number(comida.proteinas_totales_g || 0), carbohidratos: total.carbohidratos + Number(comida.carbohidratos_totales_g || 0), grasas: total.grasas + Number(comida.grasas_totales_g || 0),
  }), { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 }), [comidasDelDia]);
  const hoy = fechaLocalDia(new Date());
  const diasNavegacion = Array.from({ length: 7 }, (_, indice) => moverDia(diaSeleccionado, indice - 3));
  const etiquetaDia = diaSeleccionado === hoy ? "Hoy" : formatoDia(diaSeleccionado);
  const gruposHistoricos = useMemo(() => agruparPorDia(comidas), [comidas]);
  const renderComida = (comida) => <MealRow key={comida.id} comida={comida} abierta={expandido === comida.id} confirmando={confirmandoId === comida.id} onToggle={() => setExpandido(expandido === comida.id ? null : comida.id)} onConfirmar={() => setConfirmandoId(comida.id)} onCancelar={() => setConfirmandoId(null)} onBorrar={() => borrarComida(comida.id)} />;

  return <main className="app"><div className="content">
    <header className="topbar"><div><p>{vista === "diario" ? etiquetaDia : vista === "historial" ? "Todos tus registros" : "Tu evolución"}</p><h1>{vista === "diario" ? "Tu día" : vista === "historial" ? "Historial" : "Health insights"}</h1></div>{vista === "historial" ? <button className="back-button" onClick={() => setVista("panel")} aria-label="Volver a progreso">‹</button> : <span className="avatar" aria-label="Perfil">●</span>}</header>
    {vista === "diario" && <section className="date-picker" aria-label="Seleccionar día"><button onClick={() => setDiaSeleccionado(moverDia(diaSeleccionado, -1))} aria-label="Día anterior">‹</button><div>{diasNavegacion.map((dia) => { const fecha = formatoNav(dia); return <button key={dia} className={dia === diaSeleccionado ? "selected" : ""} onClick={() => setDiaSeleccionado(dia)}><small>{fecha.semana}</small><b>{fecha.numero}</b></button>; })}</div><button onClick={() => setDiaSeleccionado(moverDia(diaSeleccionado, 1))} aria-label="Día siguiente">›</button></section>}
    {error && <p className="error">{error}</p>}
    {cargando ? <p className="empty-state">Cargando registros…</p> : vista === "panel" ? <AnalyticsPanel comidas={comidas} objetivos={OBJETIVOS} onVerHistorial={() => setVista("historial")} /> : vista === "historial" ? <section className="history-list">{gruposHistoricos.length ? gruposHistoricos.map(([dia, items]) => <section className="history-day" key={dia}><div className="list-title"><h2>{formatoDia(dia)}</h2><span>{items.length} registradas</span></div>{items.map(renderComida)}</section>) : <p className="empty-state">Todavía no hay comidas registradas.</p>}</section> : <>
      <section className="daily-summary"><div className="section-heading"><div><span>Resumen de {etiquetaDia.toLowerCase()}</span><strong>{Math.round(totales.calorias)} <small>/ {OBJETIVOS.calorias} kcal</small></strong></div><span className="goal-status">{Math.max(0, OBJETIVOS.calorias - Math.round(totales.calorias))} kcal restantes</span></div><div className="rings"><MacroRing etiqueta="Calorías" valor={totales.calorias} maximo={OBJETIVOS.calorias} unidad="" /><MacroRing etiqueta="Proteína" valor={totales.proteinas} maximo={OBJETIVOS.proteinas} /><MacroRing etiqueta="Carbos" valor={totales.carbohidratos} maximo={OBJETIVOS.carbohidratos} /><MacroRing etiqueta="Grasas" valor={totales.grasas} maximo={OBJETIVOS.grasas} /></div></section>
      <section className="meal-section"><div className="list-title"><h2>Comidas</h2><span>{comidasDelDia.length} registradas</span></div>{comidasDelDia.length ? comidasDelDia.map(renderComida) : <p className="empty-state">No hay comidas registradas este día.</p>}</section>
    </>}
  </div><nav className="bottom-nav" aria-label="Navegación principal"><button className={vista === "diario" ? "active" : ""} onClick={() => { setDiaSeleccionado(hoy); setVista("diario"); }}><b>⌂</b>Hoy</button><button className="scan-button" onClick={() => { setPanelAbierto(true); setMensaje(null); }} aria-label="Registrar comida">＋</button><button className={vista === "panel" || vista === "historial" ? "active" : ""} onClick={() => setVista("panel")}><b>⌁</b>Progreso</button></nav><NewMealDrawer abierto={panelAbierto} texto={textoJson} mensaje={mensaje} guardando={guardando} onTexto={setTextoJson} onCerrar={() => setPanelAbierto(false)} onGuardar={guardarRegistro} /></main>;
}

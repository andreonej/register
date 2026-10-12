import { useEffect, useMemo, useRef, useState } from "react";
import { AnalyticsPanel } from "./components/AnalyticsPanel";
import { COLORES_MACROS, MacroRing } from "./components/MacroBar";
import { MealRow } from "./components/MealRow";
import { NewMealDrawer } from "./components/NewMealDrawer";
import { ProfileView } from "./components/ProfileView";
import { agruparPorDia, fechaLocalDia, formatoDia } from "./lib/date";
import { calcularObjetivosNutricionales } from "./lib/metabolismo";
import { actualizarComida, crearComida, eliminarComida, obtenerComidas } from "./services/comidas";
import { obtenerPerfilActivo, obtenerHistorialPesos, registrarPeso } from "./services/perfil";
import { obtenerModeloSeleccionado, guardarModeloSeleccionado } from "./services/gemini";
import { analizarProgreso } from "./lib/progresoIntelligence";
import "./App.css";

const diaIso = (fecha) => `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
const moverDia = (dia, cantidad) => { const fecha = new Date(`${dia}T12:00:00`); fecha.setDate(fecha.getDate() + cantidad); return diaIso(fecha); };
const formatoNav = (dia) => { const fecha = new Date(`${dia}T12:00:00`); return { semana: fecha.toLocaleDateString("es-AR", { weekday: "short" }).replace(".", ""), numero: fecha.getDate() }; };
const fechaHoraLocal = (fecha = new Date()) => `${diaIso(fecha)} ${String(fecha.getHours()).padStart(2, "0")}:${String(fecha.getMinutes()).padStart(2, "0")}`;

function franjaHoraria(fecha) {
  const hora = fecha.getHours();
  if (hora >= 5 && hora < 11) return "Desayuno";
  if (hora >= 11 && hora < 15) return "Almuerzo";
  if (hora >= 15 && hora < 19) return "Merienda";
  if (hora >= 19 && hora < 24) return "Cena";
  return "Otros";
}

function normalizarNombreComida(nombre) {
  return String(nombre || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-AR").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export default function DiarioComidas() {
  const [comidas, setComidas] = useState([]);
  const [perfil, setPerfil] = useState(null);
  const [historialPesos, setHistorialPesos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [vista, setVista] = useState("diario"); // "diario" | "panel" | "historial" | "perfil"
  const [diaSeleccionado, setDiaSeleccionado] = useState(() => fechaLocalDia(new Date()));
  const [modeloGemini, setModeloGemini] = useState(obtenerModeloSeleccionado);
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [menuRapidoAbierto, setMenuRapidoAbierto] = useState(false);
  const [accionInicial, setAccionInicial] = useState(null);
  const [textoJson, setTextoJson] = useState("");
  const [mensaje, setMensaje] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [expandido, setExpandido] = useState(null);
  const [confirmandoId, setConfirmandoId] = useState(null);
  const [avisoGuardado, setAvisoGuardado] = useState(null);
  const avisoGuardadoTimer = useRef(null);
  const [comidaPendienteBorrar, setComidaPendienteBorrar] = useState(null);
  const borrarTimer = useRef(null);
  const [mesCalendario, setMesCalendario] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  useEffect(() => () => { clearTimeout(avisoGuardadoTimer.current); clearTimeout(borrarTimer.current); }, []);

  async function cargarDatosIniciales() {
    setCargando(true);
    setError(null);
    try {
      const [comidasData, perfilData] = await Promise.all([
        obtenerComidas(),
        obtenerPerfilActivo()
      ]);
      setComidas(comidasData);
      setPerfil(perfilData);
      const pesosData = await obtenerHistorialPesos(perfilData?.id);
      setHistorialPesos(pesosData);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarDatosIniciales();
  }, []);

  async function recargarPesos() {
    if (perfil?.id) {
      const pesos = await obtenerHistorialPesos(perfil.id);
      setHistorialPesos(pesos);
    }
  }

  async function registrarPesoProgreso({ pesoKg, fecha }) {
    try {
      await registrarPeso({ perfilId: perfil?.id, pesoKg, fecha });
      await recargarPesos();
      setPerfil((actual) => ({ ...actual, peso_actual: Number(pesoKg) }));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }

  // Cálculo dinámico del peso actual y metas metabólicas
  const pesoActual = useMemo(() => {
    return historialPesos[0]?.peso_kg || perfil?.peso_actual || 75;
  }, [historialPesos, perfil]);

  const objetivos = useMemo(() => {
    const calc = calcularObjetivosNutricionales(perfil || {}, pesoActual);
    return {
      calorias: calc.calorias,
      proteinas: calc.proteinas,
      carbohidratos: calc.carbohidratos,
      grasas: calc.grasas
    };
  }, [perfil, pesoActual]);

  const cierreBrechaHoy = useMemo(() => analizarProgreso({ comidas, objetivos, perfil: perfil || {}, historialPesos }).sugerenciasBrecha, [comidas, objetivos, perfil, historialPesos]);

  const comidasFrecuentes = useMemo(() => {
    const grupos = new Map();
    for (const comida of comidas) {
      const nombre = normalizarNombreComida(comida.comida_nombre);
      const fecha = new Date(comida.fecha);
      if (!nombre || Number.isNaN(fecha.getTime())) continue;
      const franja = franjaHoraria(fecha);
      const clave = `${nombre}|${franja}`;
      const grupo = grupos.get(clave) || { clave, comida, franja, frecuencia: 0, ultimaFecha: 0 };
      grupo.frecuencia += 1;
      if (fecha.getTime() > grupo.ultimaFecha) {
        grupo.comida = comida;
        grupo.ultimaFecha = fecha.getTime();
      }
      grupos.set(clave, grupo);
    }
    const franjaActual = franjaHoraria(new Date());
    return [...grupos.values()]
      .sort((a, b) => Number(b.franja === franjaActual) - Number(a.franja === franjaActual) || b.frecuencia - a.frecuencia || b.ultimaFecha - a.ultimaFecha)
      .slice(0, 4);
  }, [comidas]);

  const comidaMasReciente = useMemo(() => comidas.reduce((reciente, comida) => {
    if (!reciente) return comida;
    return new Date(comida.fecha).getTime() > new Date(reciente.fecha).getTime() ? comida : reciente;
  }, null), [comidas]);

  async function guardarRegistro(registroObj) {
    setGuardando(true);
    setMensaje(null);
    try {
      const registro = (registroObj && typeof registroObj === "object") ? registroObj : JSON.parse(textoJson);
      const comidaGuardada = await crearComida(registro, perfil?.id);
      setTextoJson("");
      setPanelAbierto(false);
      setComidas((actuales) => [comidaGuardada, ...actuales.filter((comida) => comida.id !== comidaGuardada.id)]);
      let comidaVisible = comidaGuardada;
      try {
        const comidasActualizadas = await obtenerComidas();
        setComidas(comidasActualizadas);
        comidaVisible = comidasActualizadas.find((comida) => comida.id === comidaGuardada.id) || comidaGuardada;
      } catch {
        setError("La comida se guardó, pero no se pudo actualizar la lista.");
      }
      const diaComida = fechaLocalDia(comidaVisible.fecha || registro.fecha);
      setDiaSeleccionado(diaComida);
      setVista("diario");
      setAvisoGuardado({ comida: comidaVisible, calorias: Math.round(Number(comidaVisible.calorias_totales || 0)) });
      clearTimeout(avisoGuardadoTimer.current);
      avisoGuardadoTimer.current = setTimeout(() => setAvisoGuardado(null), 4000);
      window.setTimeout(() => document.getElementById(`comida-${comidaVisible.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
      if (comidaGuardada.foto_error) setError(`La comida se guardó, pero no se pudo guardar su foto: ${comidaGuardada.foto_error}`);
    } catch (err) {
      setMensaje({ tipo: "error", texto: err.message.includes("JSON") ? "El texto no es un JSON válido" : err.message });
    } finally {
      setGuardando(false);
    }
  }

  function registrarComidaExistente(comida, factor = 1) {
    if (!comida) return;
    const escala = (valor) => Math.round((Number(valor || 0) * factor + Number.EPSILON) * 100) / 100;
    const fecha = fechaHoraLocal();
    const registro = {
      comida_nombre: comida.comida_nombre,
      fecha,
      nivel_confianza: comida.nivel_confianza || "Medio",
      factor_porcion: factor,
      totales_plato: {
        calorias: escala(comida.calorias_totales),
        proteinas_g: escala(comida.proteinas_totales_g),
        carbohidratos_g: escala(comida.carbohidratos_totales_g),
        grasas_g: escala(comida.grasas_totales_g)
      },
      ingredientes: (comida.comida_ingredientes || []).map((ingrediente) => ({
        ...ingrediente,
        cantidad: Math.max(1, Math.round((Number(ingrediente.cantidad) || 1) * factor)),
        peso_estimado_g: escala(ingrediente.peso_estimado_g),
        calorias: escala(ingrediente.calorias),
        proteinas_g: escala(ingrediente.proteinas_g),
        carbohidratos_g: escala(ingrediente.carbohidratos_g),
        grasas_g: escala(ingrediente.grasas_g)
      })),
      foto: null
    };
    guardarRegistro(registro);
  }

  function elegirAccionRapida(accion) {
    setMenuRapidoAbierto(false);
    setMensaje(null);
    if (accion === "reciente") {
      if (comidaMasReciente) registrarComidaExistente(comidaMasReciente);
      return;
    }
    setAccionInicial(accion);
    setPanelAbierto(true);
  }

  async function borrarComida(comida) {
    clearTimeout(borrarTimer.current);
    setComidaPendienteBorrar(comida);
    setConfirmandoId(null);
    borrarTimer.current = setTimeout(async () => {
      try { await eliminarComida(comida); setComidas((actuales) => actuales.filter((actual) => actual.id !== comida.id)); }
      catch (err) { setError(err.message); }
      setComidaPendienteBorrar(null);
    }, 5000);
  }

  function deshacerBorrado() {
    clearTimeout(borrarTimer.current);
    setComidaPendienteBorrar(null);
  }

  async function guardarEdicion(comida, ingredientes) {
    try {
      const actualizada = await actualizarComida(comida, ingredientes);
      setComidas((actuales) => actuales.map((item) => item.id === comida.id ? actualizada : item));
    } catch (err) {
      setError(err.message);
    }
  }

  async function deshacerGuardado() {
    if (!avisoGuardado) return;
    clearTimeout(avisoGuardadoTimer.current);
    try {
      await eliminarComida(avisoGuardado.comida);
      setComidas((actuales) => actuales.filter((actual) => actual.id !== avisoGuardado.comida.id));
      setAvisoGuardado(null);
    } catch (err) {
      setError(err.message);
      setAvisoGuardado(null);
    }
  }

  const comidasDelDia = useMemo(() => comidas.filter((comida) => fechaLocalDia(comida.fecha) === diaSeleccionado && comida.id !== comidaPendienteBorrar?.id), [comidas, diaSeleccionado, comidaPendienteBorrar]);
  const totales = useMemo(() => comidasDelDia.reduce((total, comida) => ({
    calorias: total.calorias + Number(comida.calorias_totales || 0),
    proteinas: total.proteinas + Number(comida.proteinas_totales_g || 0),
    carbohidratos: total.carbohidratos + Number(comida.carbohidratos_totales_g || 0),
    grasas: total.grasas + Number(comida.grasas_totales_g || 0),
  }), { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 }), [comidasDelDia]);

  const hoy = fechaLocalDia(new Date());
  const diasNavegacion = Array.from({ length: 7 }, (_, indice) => moverDia(diaSeleccionado, indice - 3));
  const etiquetaDia = diaSeleccionado === hoy ? "Hoy" : formatoDia(diaSeleccionado);
  const gruposHistoricos = useMemo(() => agruparPorDia(comidas.filter((comida) => comida.id !== comidaPendienteBorrar?.id)), [comidas, comidaPendienteBorrar]);
  const porDia = useMemo(() => comidas.reduce((mapa, comida) => { const dia = fechaLocalDia(comida.fecha); mapa[dia] = (mapa[dia] || 0) + Number(comida.calorias_totales || 0); return mapa; }, {}), [comidas]);
  const gruposFranja = useMemo(() => {
    const orden = ["Desayuno", "Almuerzo", "Merienda", "Cena", "Otros"];
    const grupos = new Map(orden.map((nombre) => [nombre, []]));
    comidasDelDia.forEach((comida) => grupos.get(franjaHoraria(new Date(comida.fecha))).push(comida));
    return orden.map((nombre) => [nombre, grupos.get(nombre)]).filter(([, items]) => items.length);
  }, [comidasDelDia]);
  const renderComida = (comida) => (
    <MealRow
      key={comida.id}
      comida={comida}
      abierta={expandido === comida.id}
      confirmando={confirmandoId === comida.id}
      onToggle={() => setExpandido(expandido === comida.id ? null : comida.id)}
      onConfirmar={() => setConfirmandoId(comida.id)}
      onCancelar={() => setConfirmandoId(null)}
      onBorrar={() => borrarComida(comida)}
      onEditar={() => setExpandido(comida.id)}
      onGuardarEdicion={(ingredientes) => guardarEdicion(comida, ingredientes)}
    />
  );

  function cambiarModelo(nuevoModelo) {
    setModeloGemini(nuevoModelo);
    guardarModeloSeleccionado(nuevoModelo);
  }

  return (
    <main className="app">
      <div className="content">
        <header className="topbar">
          <div>
            <p>
              {vista === "diario" ? etiquetaDia : vista === "historial" ? "Todos tus registros" : vista === "perfil" ? "Ajustes y métricas" : vista === "calendario" ? "Registro diario" : vista === "panel" ? "Evolución y hábitos" : "Tu evolución"}
            </p>
            <h1>
              {vista === "diario" ? "Tu día" : vista === "historial" ? "Historial" : vista === "perfil" ? "Perfil" : vista === "calendario" ? "Calendario" : "Progreso"}
              {vista === "diario" && diaSeleccionado !== hoy && (
                <button className="today-pill" onClick={() => setDiaSeleccionado(hoy)} aria-label="Volver a hoy">← Hoy</button>
              )}
            </h1>
          </div>
          {vista === "historial" ? (
            <button className="back-button" onClick={() => setVista("panel")} aria-label="Volver a progreso">‹</button>
          ) : vista === "perfil" ? (
            <button className="back-button" onClick={() => setVista("diario")} aria-label="Volver al diario">‹</button>
          ) : vista === "calendario" ? (
            <button className="back-button" onClick={() => setVista("diario")} aria-label="Volver al diario">‹</button>
          ) : (
            <div className="topbar-actions">
              {vista === "diario" && <button className="calendar-button" onClick={() => { setMesCalendario(new Date(`${diaSeleccionado}T12:00:00`)); setVista("calendario"); }} aria-label="Abrir calendario mensual" title="Calendario"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg></button>}
              <button className="avatar" onClick={() => setVista("perfil")} aria-label="Ver perfil de usuario" title="Abrir perfil de usuario">
                {perfil?.nombre ? perfil.nombre.charAt(0).toUpperCase() : "●"}
              </button>
            </div>
          )}
        </header>

        {vista === "calendario" && (() => {
          const inicio = new Date(mesCalendario.getFullYear(), mesCalendario.getMonth(), 1);
          const diasMes = new Date(mesCalendario.getFullYear(), mesCalendario.getMonth() + 1, 0).getDate();
          const desplazamiento = (inicio.getDay() + 6) % 7;
          return <section className="monthly-calendar">
            <div className="calendar-month-heading"><button onClick={() => setMesCalendario(new Date(mesCalendario.getFullYear(), mesCalendario.getMonth() - 1, 1))} aria-label="Mes anterior">‹</button><h2>{mesCalendario.toLocaleDateString("es-AR", { month: "long", year: "numeric" })}</h2><button onClick={() => setMesCalendario(new Date(mesCalendario.getFullYear(), mesCalendario.getMonth() + 1, 1))} aria-label="Mes siguiente">›</button></div>
            <div className="calendar-grid">{"LMXJVSD".split("").map((dia, i) => <b key={i}>{dia}</b>)}{Array.from({ length: desplazamiento }, (_, i) => <span key={`blank-${i}`} />)}{Array.from({ length: diasMes }, (_, i) => { const dia = `${mesCalendario.getFullYear()}-${String(mesCalendario.getMonth() + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`; const calorias = porDia[dia]; const clase = calorias == null ? "" : calorias < objetivos.calorias * .9 ? "below" : calorias > objetivos.calorias * 1.1 ? "above" : "in-range"; return <button key={dia} className={`${dia === diaSeleccionado ? "selected" : ""} ${clase}`} onClick={() => { setDiaSeleccionado(dia); setVista("diario"); }}>{i + 1}{clase && <i />}</button>; })}</div>
            <p className="calendar-legend"><span className="in-range" /> En banda <span className="below" /> Por debajo <span className="above" /> Por encima</p>
          </section>;
        })()}

        {vista === "diario" && (
          <section className="date-picker" aria-label="Seleccionar día">
            <button onClick={() => setDiaSeleccionado(moverDia(diaSeleccionado, -1))} aria-label="Día anterior">‹</button>
            <div>
              {diasNavegacion.map((dia) => {
                const fecha = formatoNav(dia);
                return (
                  <button
                    key={dia}
                    className={dia === diaSeleccionado ? "selected" : ""}
                    onClick={() => setDiaSeleccionado(dia)}
                  >
                    <small>{fecha.semana}</small>
                    <b>{fecha.numero}</b>
                    {porDia[dia] != null && <i className={`day-status ${porDia[dia] < objetivos.calorias * .9 ? "below" : porDia[dia] > objetivos.calorias * 1.1 ? "above" : "in-range"}`} />}
                  </button>
                );
              })}
            </div>
            <button onClick={() => setDiaSeleccionado(moverDia(diaSeleccionado, 1))} aria-label="Día siguiente">›</button>

          </section>
        )}

        {error && <p className="error">{error}</p>}

        {cargando ? (
          <p className="empty-state">Cargando registros…</p>
        ) : vista === "calendario" ? null : vista === "perfil" ? (
          <ProfileView
            perfil={perfil || {}}
            historialPesos={historialPesos}
            textoDebug={textoJson}
            mensajeDebug={mensaje}
            guardandoDebug={guardando}
            onTextoDebug={setTextoJson}
            onGuardarDebug={() => guardarRegistro()}
            modeloActivo={modeloGemini}
            onCambiarModelo={cambiarModelo}
            onPerfilActualizado={(p) => setPerfil(p)}
            onPesosActualizados={recargarPesos}
            onVolver={() => setVista("diario")}
          />
        ) : vista === "panel" ? (
          <AnalyticsPanel
            comidas={comidas}
            objetivos={objetivos}
            perfil={perfil || {}}
            historialPesos={historialPesos}
            onVerHistorial={() => setVista("historial")}
            onRegistrarPeso={registrarPesoProgreso}
          />
        ) : vista === "historial" ? (
          <section className="history-list">
            {gruposHistoricos.length ? (
              gruposHistoricos.map(([dia, items]) => (
                <section className="history-day" key={dia}>
                  <div className="list-title">
                    <h2>{formatoDia(dia)}</h2>
                    <span>{items.length} registradas</span>
                  </div>
                  {items.map(renderComida)}
                </section>
              ))
            ) : (
              <p className="empty-state">Todavía no hay comidas registradas.</p>
            )}
          </section>
        ) : (
          <>
            <section className="daily-summary">
              <div className="section-heading">
                <div>
                  <span>Resumen de {etiquetaDia.toLowerCase()}</span>
                  <strong>
                    {Math.round(totales.calorias)} <small>/ {objetivos.calorias} kcal</small>
                  </strong>
                </div>
                <span className="goal-status">
                  {Math.max(0, objetivos.calorias - Math.round(totales.calorias))} kcal restantes
                </span>
              </div>
              <div className="rings">
                <MacroRing etiqueta="Proteína" valor={totales.proteinas} maximo={objetivos.proteinas} color={COLORES_MACROS.proteinas} />
                <MacroRing etiqueta="Carbos" valor={totales.carbohidratos} maximo={objetivos.carbohidratos} color={COLORES_MACROS.carbohidratos} />
                <MacroRing etiqueta="Grasas" valor={totales.grasas} maximo={objetivos.grasas} color={COLORES_MACROS.grasas} />
              </div>
            </section>

            <section className="meal-section">
              <div className="list-title">
                <h2>Comidas</h2>
                <span>{comidasDelDia.length} registradas</span>
              </div>
              {comidasDelDia.length ? gruposFranja.map(([franja, items]) => <section className="meal-time-group" key={franja}><div className="meal-time-heading"><h3>{franja}</h3><span>Subtotal · {Math.round(items.reduce((suma, item) => suma + Number(item.calorias_totales || 0), 0))} kcal</span></div>{items.map(renderComida)}</section>) : <p className="empty-state">No hay comidas registradas este día.</p>}
            </section>

            {diaSeleccionado === hoy && objetivos.proteinas - totales.proteinas > 15 && (
              <section className="gap-today-card"><strong>Cierre de brecha</strong>{cierreBrechaHoy.length ? <div className="gap-today-options">{cierreBrechaHoy.map((sugerencia, index) => <p key={index}><b>{sugerencia.titulo}</b><span>+{sugerencia.proteinas} g proteína · {sugerencia.calorias} kcal · {sugerencia.grasas} g grasa · {sugerencia.carbohidratos} g carbos</span></p>)}</div> : <p>No hay una opción habitual que quepa en tus objetivos restantes. No hace falta forzar una sugerencia.</p>}</section>
            )}
          </>
        )}
      </div>

      {menuRapidoAbierto && (
        <div className="quick-entry-backdrop" role="presentation" onClick={() => setMenuRapidoAbierto(false)}>
          <section className="quick-entry-sheet" role="dialog" aria-modal="true" aria-labelledby="quick-entry-title" onClick={(evento) => evento.stopPropagation()}>
            <span className="sheet-handle" />
            <div className="quick-entry-heading">
              <h2 id="quick-entry-title">Cargar comida</h2>
              <button type="button" className="drawer-close" aria-label="Cerrar menú" onClick={() => setMenuRapidoAbierto(false)}>✕</button>
            </div>
            <button type="button" className="quick-entry-option" onClick={() => elegirAccionRapida("camara")}>
              <strong>Cámara</strong><span>Tomar una foto y analizar</span>
            </button>
            <button type="button" className="quick-entry-option" onClick={() => elegirAccionRapida("galeria")}>
              <strong>Galería</strong><span>Elegir una foto</span>
            </button>
            <button type="button" className="quick-entry-option" onClick={() => elegirAccionRapida("describir")}>
              <strong>Describir</strong><span>Escribir qué comiste</span>
            </button>
            <button type="button" className="quick-entry-option" disabled={!comidaMasReciente} onClick={() => elegirAccionRapida("reciente")}>
              <strong>Repetir reciente</strong>
              <span>{comidaMasReciente ? `${comidaMasReciente.comida_nombre} · ${Math.round(Number(comidaMasReciente.calorias_totales || 0))} kcal` : "Todavía no hay comidas guardadas"}</span>
            </button>
          </section>
        </div>
      )}

      {comidaPendienteBorrar && <div className="undo-toast" role="status">Se eliminará en unos segundos <button onClick={deshacerBorrado}>Deshacer</button></div>}

      <nav className="bottom-nav" aria-label="Navegación principal">
        <button
          className={vista === "diario" ? "active" : ""}
          onClick={() => { setDiaSeleccionado(hoy); setVista("diario"); }}
        >
          <b>⌂</b>Hoy
        </button>
        <button
          className="scan-button"
          onClick={() => { setMenuRapidoAbierto(true); setMensaje(null); }}
          aria-label="Registrar comida"
        >
          ＋
        </button>
        <button
          className={vista === "panel" || vista === "historial" ? "active" : ""}
          onClick={() => setVista("panel")}
        >
          <b>⌁</b>Progreso
        </button>
      </nav>

      {avisoGuardado && (
        <div className="save-toast" role="status" aria-live="polite">
          <span>+{avisoGuardado.calorias} kcal añadidas</span>
          <button type="button" onClick={deshacerGuardado}>Deshacer</button>
        </div>
      )}

      <NewMealDrawer
        abierto={panelAbierto}
        mensaje={mensaje}
        guardando={guardando}
        modeloActivo={modeloGemini}
        onCambiarModelo={cambiarModelo}
        onCerrar={() => setPanelAbierto(false)}
        onGuardar={guardarRegistro}
        accionInicial={accionInicial}
        onAccionInicialCompletada={() => setAccionInicial(null)}
        comidasFrecuentes={comidasFrecuentes}
        onRegistrarComida={registrarComidaExistente}
      />
    </main>
  );
}

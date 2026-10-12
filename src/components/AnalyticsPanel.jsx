import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Line,
  LineChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ReferenceArea
} from "recharts";
import { analizarProgreso } from "../lib/progresoIntelligence";
import { COLORES_MACROS } from "./MacroBar";

export function AnalyticsPanel({
  comidas = [],
  objetivos = { calorias: 2000, proteinas: 140, carbohidratos: 200, grasas: 65 },
  perfil = {},
  historialPesos = [],
  onVerHistorial,
  onRegistrarPeso
}) {
  const [diaSeleccionadoGrafico, setDiaSeleccionadoGrafico] = useState(null);
  const [periodo, setPeriodo] = useState("semana");
  const [filtroCategoria, setFiltroCategoria] = useState("todos");
  const [nuevoPeso, setNuevoPeso] = useState("");
  const [fechaPeso, setFechaPeso] = useState(() => { const hoy = new Date(); return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`; });
  const [guardandoPeso, setGuardandoPeso] = useState(false);

  const analisis = useMemo(() => {
    return analizarProgreso({ comidas, objetivos, perfil, historialPesos, ventanaDias: periodo === "semana" ? 7 : 30 });
  }, [comidas, objetivos, perfil, historialPesos, periodo]);

  const {
    dias = [],
    totalDiasRegistrados = 0,
    totalDiasCompletos = 0,
    pisoCalorias = 1500,
    techoCalorias = 2200,
    promedioCalorias = 0,
    promedioProteinas = 0,
    promedioCarbos = 0,
    promedioGrasas = 0,
    heroInfo = { tipo: "mantener", tituloHéroe: "Progreso", valorPrincipal: "0", unidadPrincipal: "kcal", subtitulo: "", badgeTexto: "Comenzando", badgeTipo: "neutro" },
    scoreDiversidad = 0,
    topIngredientes = [],
    sugerenciasBrecha = [],
    proteinasFaltantesHoy = 0,
    caloriasRestantesHoy = 0,
    grasasRestantesHoy = 0,
    carbohidratosRestantesHoy = 0,
    diagnosticoAtribucion = null,
    mensajeProyeccion = null,
    contextoFinde = { promSemana: 0, promFinSemana: 0, diferencia: 0 }
  } = analisis || {};

  const tooltipCustom = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="custom-chart-tooltip">
          <b>{new Date(`${data.dia}T12:00:00`).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}</b>
          <div className="tooltip-cal">
            <strong>{data.calorias} kcal</strong>
            <span>Diferencia vs. meta: {data.calorias - objetivos.calorias > 0 ? "+" : ""}{data.calorias - objetivos.calorias} kcal</span>
            <span className={`tooltip-tag status-${data.estado}`}>
              {data.estado === "en_meta"
                ? "En banda"
                : data.estado === "por_debajo"
                ? "Por debajo"
                : data.estado === "por_encima"
                ? "Por encima"
                : "Sin datos"}
              {data.esHoy ? " · En curso" : ""}
            </span>
          </div>
          {data.calorias > 0 && (
            <div className="tooltip-macros">
              <span>🥩 {data.proteinas}g</span>
              <span>🥑 {data.grasas}g</span>
              <span>🍞 {data.carbohidratos}g</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const pesosUltimos30Dias = useMemo(() => {
    const limite = new Date();
    limite.setDate(limite.getDate() - 29);
    return historialPesos
      .filter((item) => new Date(`${item.fecha}T12:00:00`) >= limite)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map((item) => ({ ...item, etiqueta: new Date(`${item.fecha}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "short" }) }));
  }, [historialPesos]);

  async function guardarPeso(evento) {
    evento.preventDefault();
    if (!nuevoPeso || Number(nuevoPeso) <= 0 || !onRegistrarPeso) return;
    setGuardandoPeso(true);
    try {
      await onRegistrarPeso({ pesoKg: nuevoPeso, fecha: fechaPeso });
      setNuevoPeso("");
    } finally {
      setGuardandoPeso(false);
    }
  }

  return (
    <section className="insights-redesign">
      {/* 1. Encabezado */}
      <div className="insights-header">
        <div>
          <span className="eyebrow">Seguimiento personal</span>
        </div>
        <span className="goal-pill-tag">
          Objetivo: {perfil?.objetivo === "bajar" ? "📉 Déficit" : perfil?.objetivo === "subir" ? "📈 Superávit" : "⚖️ Mantener"}
        </span>
      </div>

      {/* 2. Tarjeta Héroe Adaptativa según el Objetivo */}
      <div className={`hero-metric-card hero-theme-${heroInfo.tipo}`}>
        <div className="hero-head">
          <div>
            <span className="hero-eyebrow">{heroInfo.tituloHéroe}</span>
            <div className="hero-main-stat">
              <strong>{heroInfo.valorPrincipal}</strong>
              <small>{heroInfo.unidadPrincipal}</small>
            </div>
          </div>
          <span className={`hero-badge badge-${heroInfo.badgeTipo}`}>
            {heroInfo.badgeTexto}
          </span>
        </div>

        <p className="hero-sub">{heroInfo.subtitulo}</p>

        {heroInfo.detalleRitmo && (
          <div className="hero-footer-insight">
            <span>⚡ {heroInfo.detalleRitmo}</span>
          </div>
        )}

        {heroInfo.avisoPiso && (
          <div className="hero-warning-box">
            <span>⚠️ {heroInfo.avisoPiso}</span>
          </div>
        )}
      </div>

      {/* 3. Gráfico Semanal con Bandas Asimétricas */}
      <div className="insight-card chart-card">
        <div className="card-heading">
          <div>
            <h3>Ingesta y Banda Óptima</h3>
            <span>
              Banda recomendada: <b>{pisoCalorias}–{techoCalorias} kcal</b>
            </span>
          </div>
          <div className="chart-period-selector" role="group" aria-label="Período del gráfico">
            <button className={periodo === "semana" ? "active" : ""} onClick={() => { setPeriodo("semana"); setDiaSeleccionadoGrafico(null); }}>Semana</button>
            <button className={periodo === "mes" ? "active" : ""} onClick={() => { setPeriodo("mes"); setDiaSeleccionadoGrafico(null); }}>Mes</button>
          </div>
          <div className="chart-legend-mini">
            <span className="legend-dot green">En banda</span>
            <span className="legend-dot blue">Por debajo</span>
            <span className="legend-dot orange">Por encima</span>
          </div>
        </div>

        <div className="weekly-chart-box">
          <ResponsiveContainer width="100%" height={185}>
            <BarChart data={dias} barCategoryGap="24%">
              <XAxis
                dataKey="etiqueta"
                tick={{ fontSize: 11, fill: "#737373", fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide domain={[0, (dataMax) => Math.max(dataMax + 250, techoCalorias + 200)]} />
              <Tooltip content={tooltipCustom} cursor={{ fill: "#f5f5f3" }} />
              <ReferenceArea
                y1={pisoCalorias}
                y2={techoCalorias}
                fill="#10b981"
                fillOpacity={0.08}
                stroke="#10b981"
                strokeOpacity={0.25}
                strokeDasharray="3 3"
              />
              <Bar dataKey="calorias" radius={[6, 6, 2, 2]} onClick={(item) => setDiaSeleccionadoGrafico(item?.dia || item?.payload?.dia || null)}>
                {dias.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.colorBarra}
                    fillOpacity={entry.esHoy ? 0.72 : 1}
                    stroke={entry.esHoy ? entry.colorBarra : "none"}
                    strokeWidth={entry.esHoy ? 2 : 0}
                    strokeDasharray={entry.esHoy ? "4 3" : undefined}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {diaSeleccionadoGrafico && (() => { const dia = dias.find((item) => item.dia === diaSeleccionadoGrafico); return dia ? <div className="selected-chart-day"><b>{new Date(`${dia.dia}T12:00:00`).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}</b><span>{dia.calorias} kcal</span><span>Diferencia vs. meta: {dia.calorias - objetivos.calorias > 0 ? "+" : ""}{dia.calorias - objetivos.calorias} kcal</span></div> : null; })()}

        <div className="chart-footer-meta">
          <div className="meta-stat">
            <small>Promedio diario</small>
            <b>{promedioCalorias} <small>kcal</small></b>
          </div>
          <div className="meta-stat">
            <small>Días registrados</small>
            <b>{totalDiasRegistrados} <small>/ {totalDiasCompletos}</small></b>
          </div>
          <div className="meta-stat">
            <small>Meta diaria</small>
            <b>{objetivos.calorias} <small>kcal</small></b>
          </div>
        </div>
      </div>

      {/* 4. Cerrar la brecha ("Comé esto con tus alimentos habituales") */}
      {proteinasFaltantesHoy > 15 && (
        <div className="insight-card gap-closer-card">
          <div className="card-heading">
            <div>
              <span className="badge-recommend">💡 Cierre de Brecha de Hoy</span>
              <h3>Completar tu Meta de Proteína</h3>
            </div>
            <span className="gap-missing">Faltan {proteinasFaltantesHoy}g</span>
          </div>
          <p className="gap-desc">Te quedan {caloriasRestantesHoy} kcal, {grasasRestantesHoy} g de grasa y {carbohidratosRestantesHoy} g de carbohidratos para hoy. Las opciones se limitan a esos valores.</p>

          {sugerenciasBrecha.length ? <div className="suggestions-grid">
            {sugerenciasBrecha.map((sug, idx) => (
              <div key={idx} className="suggestion-pill-card">
                <div className="sug-icon">🍽️</div>
                <div className="sug-text">
                  <strong>{sug.titulo}</strong>
                  <span>+{sug.proteinas} g proteína · {sug.calorias} kcal · {sug.grasas} g grasa · {sug.carbohidratos} g carbos</span>
                  <small>{sug.motivo}</small>
                </div>
              </div>
            ))}
          </div> : <p className="empty-state-mini">Ya estás cerca de tu meta. No hay una opción habitual que respete los nutrientes que te quedan hoy.</p>}
        </div>
      )}

      {/* 5. Balance de Macronutrientes */}
      <div className="insight-card macros-summary-card">
        <div className="card-heading">
          <div>
            <h3>Balance Nutricional Real</h3>
            <span>Promedio de los días registrados</span>
          </div>
        </div>

        <div className="macro-breakdown-list">
          <MacroBarDetail
            etiqueta="Proteína"
            emoji="🥩"
            valor={promedioProteinas}
            objetivo={objetivos.proteinas}
            color={COLORES_MACROS.proteinas}
            destacado={heroInfo.tipo === "subir"}
          />
          <MacroBarDetail
            etiqueta="Carbohidratos"
            emoji="🍞"
            valor={promedioCarbos}
            objetivo={objetivos.carbohidratos}
            color={COLORES_MACROS.carbohidratos}
          />
          <MacroBarDetail
            etiqueta="Grasas"
            emoji="🥑"
            valor={promedioGrasas}
            objetivo={objetivos.grasas}
            color={COLORES_MACROS.grasas}
          />
        </div>
      </div>

      {/* 5. Patrones de Contexto: Semana vs. Fin de semana */}
      <div className="insight-card weekend-pattern-card">
        {!contextoFinde.datosSuficientes ? (
          <p className="empty-state-mini">Aún sin datos suficientes</p>
        ) : (
          <>
          <div className="card-heading">
            <div>
              <h3>Patrón Semana vs. Fin de Semana</h3>
              <span>Evolución según el día</span>
            </div>
          </div>

          <div className="weekend-comparison-grid">
            <div className="pattern-pill">
              <small>Lunes a Viernes</small>
              <strong>{contextoFinde.promSemana} <small>kcal/día</small></strong>
            </div>
            <div className="pattern-pill">
              <small>Sábado y Domingo</small>
              <strong>{contextoFinde.promFinSemana} <small>kcal/día</small></strong>
            </div>
          </div>

          <p className="pattern-insight">
            {contextoFinde.diferencia > 120
              ? `Los fines de semana promedian ${contextoFinde.diferencia} kcal más que los días de semana.`
              : contextoFinde.diferencia < -120
              ? `Los fines de semana promedian ${Math.abs(contextoFinde.diferencia)} kcal menos que los días de semana.`
              : "Los promedios de ambos períodos son similares."}
          </p>
          </>
        )}
      </div>

      {/* 6. ADN Alimentario & Diversidad de la Dieta */}
      <div className="insight-card dna-ingredients-card">
        <div className="card-heading">
          <div>
            <span className="eyebrow">Identidad Nutricional</span>
            <h3>Tu ADN Alimentario</h3>
          </div>
          <span className="diversity-badge">
            🌱 {scoreDiversidad} ingredientes únicos
          </span>
        </div>
        <p className="dna-desc">
          Los alimentos más frecuentes en tus registros y base de tu dieta:
        </p>

        <div className="ingredient-category-filters" role="group" aria-label="Filtrar alimentos frecuentes">
          {[['todos', 'Todos'], ['proteinas', 'Proteínas'], ['verduras', 'Verduras'], ['alcohol', 'Alcohol'], ['ultraprocesados', 'Ultraprocesados'], ['otros', 'Otros']].map(([key, label]) => <button key={key} className={filtroCategoria === key ? "active" : ""} onClick={() => setFiltroCategoria(key)}>{label}</button>)}
        </div>
        <div className="ingredients-cloud">
          {topIngredientes.filter((item) => filtroCategoria === "todos" || item.categoria === filtroCategoria).slice(0, 10).length > 0 ? (
            topIngredientes.filter((item) => filtroCategoria === "todos" || item.categoria === filtroCategoria).slice(0, 10).map((item) => (
              <div key={item.nombreNorm} className="ingredient-tag-pill">
                <b>{item.nombreOriginal}</b>
                <span>{item.veces}×</span>
              </div>
            ))
          ) : (
            <p className="empty-state-mini">Registra más comidas para descubrir tu repertorio.</p>
          )}
        </div>

        {diagnosticoAtribucion && (
          <div className="attribution-box">
            <span className="attr-icon">🔍</span>
            <p>
              <strong>Atribución calórica:</strong> {diagnosticoAtribucion.mensaje}
            </p>
          </div>
        )}
      </div>

      {perfil?.objetivo === "mantener" && (
        <section className="insight-card weight-trend-card">
          <div className="card-heading"><div><h3>Tendencia de peso</h3><span>Últimos 30 días</span></div>{pesosUltimos30Dias.length > 0 && <strong>{pesosUltimos30Dias[pesosUltimos30Dias.length - 1].peso_kg} kg</strong>}</div>
          {pesosUltimos30Dias.length > 1 ? <div className="weight-trend-chart"><ResponsiveContainer width="100%" height={160}><LineChart data={pesosUltimos30Dias}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ececea"/><XAxis dataKey="etiqueta" tick={{ fontSize: 10 }} axisLine={false} tickLine={false}/><YAxis domain={["dataMin - 1", "dataMax + 1"]} width={38} tick={{ fontSize: 10 }} axisLine={false} tickLine={false}/><Tooltip formatter={(valor) => [`${valor} kg`, "Peso"]}/><Line type="monotone" dataKey="peso_kg" stroke="#557b69" strokeWidth={2} dot={{ r: 3 }}/></LineChart></ResponsiveContainer></div> : <p className="empty-state-mini">Registra al menos dos pesos para ver la tendencia.</p>}
          <form className="progress-weight-form" onSubmit={guardarPeso}><label>Peso (kg)<input required type="number" min="20" max="400" step="0.1" value={nuevoPeso} onChange={(event) => setNuevoPeso(event.target.value)} placeholder="Ej. 72.5"/></label><label>Fecha<input required type="date" value={fechaPeso} onChange={(event) => setFechaPeso(event.target.value)}/></label><button type="submit" disabled={guardandoPeso}>{guardandoPeso ? "Guardando…" : "Registrar peso"}</button></form>
        </section>
      )}

      {/* 8. Proyección mensual estimada */}
      {mensajeProyeccion && (
        <div className="projection-banner">
          <div className="proj-icon">🎯</div>
          <div className="proj-text">
            <strong>Proyección de tu ritmo</strong>
            <p>{mensajeProyeccion}</p>
          </div>
        </div>
      )}

      {/* 9. Botón al Historial Completo */}
      <button className="historical-link-styled" onClick={onVerHistorial}>
        <div className="link-left">
          <span className="link-icon">📑</span>
          <div>
            <strong>Ver historial completo</strong>
            <small>Consultar todos tus registros y platos pasados</small>
          </div>
        </div>
        <span className="link-arrow">›</span>
      </button>
    </section>
  );
}

function MacroBarDetail({ etiqueta, emoji, valor, objetivo, color, destacado = false }) {
  const porcentaje = Math.min(130, Math.round((valor / (objetivo || 1)) * 100));
  const porcentajeVisual = Math.min(100, porcentaje);

  return (
    <div className={`macro-bar-detail ${destacado ? "featured-macro" : ""}`}>
      <div className="macro-bar-head">
        <span className="macro-bar-name">
          {emoji} {etiqueta}
        </span>
        <div className="macro-bar-values">
          <strong>{valor}g</strong>
          <small> / {objetivo}g</small>
          <span className="macro-pct">({porcentaje}%)</span>
        </div>
      </div>
      <div className="macro-track">
        <div
          className="macro-fill"
          style={{ width: `${porcentajeVisual}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

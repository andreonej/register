import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
  ReferenceLine,
  ReferenceArea
} from "recharts";
import { analizarProgreso } from "../lib/progresoIntelligence";

export function AnalyticsPanel({
  comidas = [],
  objetivos = { calorias: 2000, proteinas: 140, carbohidratos: 200, grasas: 65 },
  perfil = {},
  historialPesos = [],
  onVerHistorial
}) {
  const [diaSeleccionadoGrafico, setDiaSeleccionadoGrafico] = useState(null);

  const analisis = useMemo(() => {
    return analizarProgreso({ comidas, objetivos, perfil, historialPesos });
  }, [comidas, objetivos, perfil, historialPesos]);

  const {
    dias,
    totalDiasRegistrados,
    pisoCalorias,
    techoCalorias,
    promedioCalorias,
    promedioProteinas,
    promedioCarbos,
    promedioGrasas,
    heroInfo,
    scoreDiversidad,
    topIngredientes,
    sugerenciasBrecha,
    diagnosticoAtribucion,
    mensajeProyeccion,
    contextoFinde
  } = analisis;

  const tooltipCustom = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="custom-chart-tooltip">
          <b>{data.etiqueta.toUpperCase()} · {data.dia}</b>
          <div className="tooltip-cal">
            <strong>{data.calorias} kcal</strong>
            <span className={`tooltip-tag status-${data.estado}`}>
              {data.estado === "en_meta"
                ? "En rango"
                : data.estado === "piso_bajo"
                ? "Bajo el piso"
                : data.estado === "exceso"
                ? "Sobre el techo"
                : data.estado === "corto"
                ? "Por debajo"
                : data.calorias === 0
                ? "Sin datos"
                : "Fuera de rango"}
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

  return (
    <section className="insights-redesign">
      {/* 1. Encabezado */}
      <div className="insights-header">
        <div>
          <span className="eyebrow">Análisis & Métricas</span>
          <h2>Evolución y Hábitos</h2>
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
          <div className="chart-legend-mini">
            <span className="legend-dot green">En meta</span>
            <span className="legend-dot orange">Exceso/Desvío</span>
            {heroInfo.tipo === "bajar" && <span className="legend-dot purple">Piso no alcanzado</span>}
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
              <Bar dataKey="calorias" radius={[6, 6, 2, 2]}>
                {dias.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.colorBarra} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-footer-meta">
          <div className="meta-stat">
            <small>Promedio diario</small>
            <b>{promedioCalorias} <small>kcal</small></b>
          </div>
          <div className="meta-stat">
            <small>Días registrados</small>
            <b>{totalDiasRegistrados} <small>/ 7</small></b>
          </div>
          <div className="meta-stat">
            <small>Meta diaria</small>
            <b>{objetivos.calorias} <small>kcal</small></b>
          </div>
        </div>
      </div>

      {/* 4. Cerrar la brecha ("Comé esto con tus alimentos habituales") */}
      {sugerenciasBrecha.length > 0 && (
        <div className="insight-card gap-closer-card">
          <div className="card-heading">
            <div>
              <span className="badge-recommend">💡 Cierre de Brecha de Hoy</span>
              <h3>Completar tu Meta de Proteína</h3>
            </div>
            <span className="gap-missing">Faltan {proteinasFaltantesHoy}g</span>
          </div>
          <p className="gap-desc">
            Alimentos habituales en tus registros para alcanzar tus {objetivos.proteinas}g de proteína:
          </p>

          <div className="suggestions-grid">
            {sugerenciasBrecha.map((sug, idx) => (
              <div key={idx} className="suggestion-pill-card">
                <div className="sug-icon">🍽️</div>
                <div className="sug-text">
                  <strong>{sug.titulo}</strong>
                  <span>{sug.aporte} · <small>{sug.motivo}</small></span>
                </div>
              </div>
            ))}
          </div>
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
            color="#2563eb"
            destacado={heroInfo.tipo === "subir"}
          />
          <MacroBarDetail
            etiqueta="Carbohidratos"
            emoji="🍞"
            valor={promedioCarbos}
            objetivo={objetivos.carbohidratos}
            color="#16a34a"
          />
          <MacroBarDetail
            etiqueta="Grasas"
            emoji="🥑"
            valor={promedioGrasas}
            objetivo={objetivos.grasas}
            color="#d97706"
          />
        </div>
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

        <div className="ingredients-cloud">
          {topIngredientes.length > 0 ? (
            topIngredientes.map((item) => (
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

      {/* 7. Patrones de Contexto: Semana vs. Fin de semana */}
      {contextoFinde.promFinSemana > 0 && contextoFinde.promSemana > 0 && (
        <div className="insight-card weekend-pattern-card">
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

          {Math.abs(contextoFinde.diferencia) > 120 && (
            <p className="pattern-insight">
              {contextoFinde.diferencia > 0
                ? `Tus fines de semana promedian +${contextoFinde.diferencia} kcal más que los días de semana. Considera compensar con mayor actividad o elegir porciones similares.`
                : `Tus fines de semana son más ligeros (-${Math.abs(contextoFinde.diferencia)} kcal). Excelente consistencia general.`}
            </p>
          )}
        </div>
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

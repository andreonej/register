import { useState, useMemo } from "react";
import {
  FACTORES_ACTIVIDAD,
  OBJETIVOS_CALORICOS,
  calcularEdad,
  calcularIMC,
  clasificarIMC,
  calcularObjetivosNutricionales
} from "../lib/metabolismo";
import {
  guardarPerfil,
  registrarPeso,
  eliminarRegistroPeso,
  asociarComidasHuerfanas
} from "../services/perfil";

export function ProfileView({
  perfil,
  historialPesos,
  onPerfilActualizado,
  onPesosActualizados,
  onVolver
}) {
  const [formData, setFormData] = useState({
    nombre: perfil.nombre || "Jose",
    sexo: perfil.sexo || "masculino",
    fecha_nacimiento: perfil.fecha_nacimiento || "1995-06-15",
    altura_cm: perfil.altura_cm || 175,
    nivel_actividad: perfil.nivel_actividad || "moderado",
    objetivo: perfil.objetivo || "mantener",
    restricciones: perfil.restricciones || "",
    zona_horaria: perfil.zona_horaria || "America/Argentina/Buenos_Aires"
  });

  const [nuevoPeso, setNuevoPeso] = useState("");
  const [fechaPeso, setFechaPeso] = useState(() => new Date().toISOString().slice(0, 10));
  const [notaPeso, setNotaPeso] = useState("");
  const [mostrarFormPeso, setMostrarFormPeso] = useState(false);
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [guardandoPeso, setGuardandoPeso] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [mostrarSql, setMostrarSql] = useState(false);

  const pesoActual = useMemo(() => {
    return historialPesos[0]?.peso_kg || perfil.peso_actual || 75;
  }, [historialPesos, perfil.peso_actual]);

  const calculo = useMemo(() => {
    return calcularObjetivosNutricionales(formData, pesoActual);
  }, [formData, pesoActual]);

  const imc = useMemo(() => {
    return calcularIMC(pesoActual, formData.altura_cm);
  }, [pesoActual, formData.altura_cm]);

  const clasificacionImc = useMemo(() => clasificarIMC(imc), [imc]);

  const cambioPeso = useMemo(() => {
    if (historialPesos.length < 2) return null;
    const diff = historialPesos[0].peso_kg - historialPesos[1].peso_kg;
    return {
      valor: Math.abs(diff).toFixed(1),
      signo: diff > 0 ? "+" : diff < 0 ? "-" : "=",
      esAumento: diff > 0
    };
  }, [historialPesos]);

  async function manejarGuardarPerfil(e) {
    e.preventDefault();
    setGuardandoPerfil(true);
    setMensaje(null);
    try {
      const actualizado = await guardarPerfil({
        ...perfil,
        ...formData,
        altura_cm: Number(formData.altura_cm),
        peso_actual: pesoActual
      });
      onPerfilActualizado(actualizado);
      setMensaje({ tipo: "ok", texto: "Perfil actualizado correctamente." });
    } catch (err) {
      setMensaje({ tipo: "error", texto: "Error al guardar: " + err.message });
    } finally {
      setGuardandoPerfil(false);
    }
  }

  async function manejarRegistrarPeso(e) {
    e.preventDefault();
    if (!nuevoPeso || isNaN(nuevoPeso) || Number(nuevoPeso) <= 0) return;
    setGuardandoPeso(true);
    try {
      await registrarPeso({
        perfilId: perfil.id,
        pesoKg: Number(nuevoPeso),
        fecha: fechaPeso,
        nota: notaPeso
      });
      onPesosActualizados();
      setNuevoPeso("");
      setNotaPeso("");
      setMostrarFormPeso(false);
      setMensaje({ tipo: "ok", texto: `Nuevo peso registrado: ${nuevoPeso} kg` });
    } catch (err) {
      setMensaje({ tipo: "error", texto: "Error al registrar peso: " + err.message });
    } finally {
      setGuardandoPeso(false);
    }
  }

  async function manejarEliminarPeso(id) {
    if (!window.confirm("¿Seguro que deseas eliminar este registro de peso?")) return;
    try {
      await eliminarRegistroPeso(id);
      onPesosActualizados();
    } catch (err) {
      setMensaje({ tipo: "error", texto: "No se pudo borrar: " + err.message });
    }
  }

  async function manejarAsociarComidas() {
    if (!perfil.id) return;
    try {
      const cantidad = await asociarComidasHuerfanas(perfil.id);
      setMensaje({
        tipo: "ok",
        texto: cantidad > 0
          ? `Se asociaron ${cantidad} comidas anteriores a tu perfil.`
          : "Todas tus comidas ya están asociadas a tu perfil."
      });
    } catch (err) {
      setMensaje({ tipo: "error", texto: err.message });
    }
  }

  return (
    <div className="profile-page">
      {/* Botón Volver */}
      <div className="profile-top-nav">
        <button className="back-button" onClick={onVolver} aria-label="Volver al diario">‹</button>
        <h2>Mi Perfil Metabólico</h2>
      </div>

      {mensaje && <p className={`message ${mensaje.tipo}`}>{mensaje.texto}</p>}

      {/* Resumen Superior del Usuario */}
      <section className="profile-hero-card">
        <div className="profile-hero-main">
          <div className="profile-avatar-big">{formData.nombre.charAt(0).toUpperCase()}</div>
          <div className="profile-hero-text">
            <h3>{formData.nombre}</h3>
            <p>
              {calculo.edad} años · {formData.sexo === "femenino" ? "Mujer" : "Hombre"} · {formData.altura_cm} cm
            </p>
          </div>
        </div>

        <div className="profile-quick-stats">
          <div className="stat-pill">
            <small>Peso actual</small>
            <b>{pesoActual} <small>kg</small></b>
            {cambioPeso && (
              <span className={`weight-diff ${cambioPeso.esAumento ? "diff-up" : "diff-down"}`}>
                {cambioPeso.signo}{cambioPeso.valor} kg
              </span>
            )}
          </div>
          <div className="stat-pill">
            <small>IMC corporal</small>
            <b>{imc}</b>
            <span className="imc-badge">{clasificacionImc}</span>
          </div>
          <div className="stat-pill">
            <small>Objetivo</small>
            <b className="goal-label">{OBJETIVOS_CALORICOS[formData.objetivo]?.etiqueta.split(" ")[0]}</b>
            <span>{OBJETIVOS_CALORICOS[formData.objetivo]?.ajusteKcal === 0 ? "Neutro" : `${OBJETIVOS_CALORICOS[formData.objetivo]?.ajusteKcal} kcal`}</span>
          </div>
        </div>
      </section>

      {/* Motor Metabólico Calculado */}
      <section className="metabolic-card">
        <div className="card-header-styled">
          <div>
            <span className="eyebrow">Fórmulas Científicas</span>
            <h3>Tu Motor Metabólico</h3>
          </div>
          <span className="formula-badge">Mifflin-St Jeor</span>
        </div>

        <div className="metabolic-trio">
          <div className="metabolic-item">
            <small>TMB (Gasto basal)</small>
            <strong>{calculo.tmb.toLocaleString()} <small>kcal</small></strong>
            <span>En reposo total</span>
          </div>
          <div className="metabolic-arrow">×</div>
          <div className="metabolic-item">
            <small>TDEE (Gasto total)</small>
            <strong>{calculo.tdee.toLocaleString()} <small>kcal</small></strong>
            <span>Con actividad ({FACTORES_ACTIVIDAD[formData.nivel_actividad]?.etiqueta})</span>
          </div>
          <div className="metabolic-arrow">=</div>
          <div className="metabolic-item highlight-item">
            <small>Meta diaria</small>
            <strong>{calculo.calorias.toLocaleString()} <small>kcal</small></strong>
            <span>{OBJETIVOS_CALORICOS[formData.objetivo]?.ajusteKcal >= 0 ? "+" : ""}{OBJETIVOS_CALORICOS[formData.objetivo]?.ajusteKcal} kcal ajuste</span>
          </div>
        </div>

        {/* Reparto de Macronutrientes */}
        <div className="macro-targets-grid">
          <div className="target-pill target-prot">
            <div className="target-head">
              <span>🥩 Proteínas</span>
              <small>{calculo.porcentajes.proteinas}% cals</small>
            </div>
            <strong>{calculo.proteinas}g</strong>
            <p>{FACTORES_ACTIVIDAD[formData.nivel_actividad]?.proteinaGPorKg} g/kg de peso</p>
          </div>

          <div className="target-pill target-fat">
            <div className="target-head">
              <span>🥑 Grasas</span>
              <small>{calculo.porcentajes.grasas}% cals</small>
            </div>
            <strong>{calculo.grasas}g</strong>
            <p>25% total (salud hormonal)</p>
          </div>

          <div className="target-pill target-carbs">
            <div className="target-head">
              <span>🍞 Carbohidratos</span>
              <small>{calculo.porcentajes.carbohidratos}% cals</small>
            </div>
            <strong>{calculo.carbohidratos}g</strong>
            <p>Resto energético</p>
          </div>
        </div>
      </section>

      {/* Historial y Registro de Peso */}
      <section className="weight-history-card">
        <div className="card-header-styled">
          <div>
            <span className="eyebrow">Evolución</span>
            <h3>Historial de Peso</h3>
          </div>
          <button
            type="button"
            className="secondary-pill-btn"
            onClick={() => setMostrarFormPeso(!mostrarFormPeso)}
          >
            {mostrarFormPeso ? "✕ Cerrar" : "＋ Cargar peso"}
          </button>
        </div>

        {mostrarFormPeso && (
          <form className="quick-weight-form" onSubmit={manejarRegistrarPeso}>
            <div className="form-row-2">
              <div className="form-field">
                <label>Peso (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  min="30"
                  max="300"
                  placeholder="ej. 75.4"
                  value={nuevoPeso}
                  onChange={(e) => setNuevoPeso(e.target.value)}
                  required
                />
              </div>
              <div className="form-field">
                <label>Fecha</label>
                <input
                  type="date"
                  value={fechaPeso}
                  onChange={(e) => setFechaPeso(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="form-field">
              <label>Nota (opcional)</label>
              <input
                type="text"
                placeholder="ej. En ayunas, después de entrenar"
                value={notaPeso}
                onChange={(e) => setNotaPeso(e.target.value)}
              />
            </div>
            <button type="submit" className="primary full-width" disabled={guardandoPeso}>
              {guardandoPeso ? "Guardando…" : "Registrar nuevo peso"}
            </button>
          </form>
        )}

        <div className="weights-list">
          {historialPesos.length === 0 ? (
            <p className="empty-state">No hay pesajes registrados todavía.</p>
          ) : (
            historialPesos.map((item, idx) => (
              <div className="weight-row" key={item.id || idx}>
                <div className="weight-row-date">
                  <b>{item.fecha}</b>
                  {item.nota && <small>{item.nota}</small>}
                </div>
                <div className="weight-row-val">
                  <strong>{item.peso_kg} <small>kg</small></strong>
                  <button
                    type="button"
                    className="delete-weight-btn"
                    onClick={() => manejarEliminarPeso(item.id)}
                    title="Eliminar registro"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Formulario de Configuración del Perfil */}
      <section className="profile-edit-card">
        <div className="card-header-styled">
          <div>
            <span className="eyebrow">Ajustes personales</span>
            <h3>Parámetros Metabólicos</h3>
          </div>
        </div>

        <form onSubmit={manejarGuardarPerfil} className="profile-form">
          <div className="form-field">
            <label>Nombre o Alias</label>
            <input
              type="text"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              required
            />
          </div>

          <div className="form-row-2">
            <div className="form-field">
              <label>Sexo Biológico (Fórmula TMB)</label>
              <div className="segmented-selector">
                <button
                  type="button"
                  className={formData.sexo === "masculino" ? "selected" : ""}
                  onClick={() => setFormData({ ...formData, sexo: "masculino" })}
                >
                  Hombre
                </button>
                <button
                  type="button"
                  className={formData.sexo === "femenino" ? "selected" : ""}
                  onClick={() => setFormData({ ...formData, sexo: "femenino" })}
                >
                  Mujer
                </button>
              </div>
            </div>

            <div className="form-field">
              <label>Altura (cm)</label>
              <input
                type="number"
                min="100"
                max="250"
                value={formData.altura_cm}
                onChange={(e) => setFormData({ ...formData, altura_cm: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-field">
            <label>Fecha de Nacimiento (calcula edad automáticamente)</label>
            <input
              type="date"
              value={formData.fecha_nacimiento}
              onChange={(e) => setFormData({ ...formData, fecha_nacimiento: e.target.value })}
              required
            />
            <small className="field-hint">Edad calculada: {calcularEdad(formData.fecha_nacimiento)} años</small>
          </div>

          {/* Selector de Nivel de Actividad */}
          <div className="form-field">
            <label>Nivel de Actividad Física</label>
            <div className="activity-selector">
              {Object.entries(FACTORES_ACTIVIDAD).map(([key, item]) => (
                <div
                  key={key}
                  className={`activity-option ${formData.nivel_actividad === key ? "selected" : ""}`}
                  onClick={() => setFormData({ ...formData, nivel_actividad: key })}
                >
                  <div className="activity-head">
                    <b>{item.etiqueta}</b>
                    <span>×{item.factor} · {item.proteinaGPorKg} g/kg prot</span>
                  </div>
                  <small>{item.descripcion}</small>
                </div>
              ))}
            </div>
          </div>

          {/* Selector de Objetivo */}
          <div className="form-field">
            <label>Objetivo Declarado</label>
            <div className="goal-selector">
              {Object.entries(OBJETIVOS_CALORICOS).map(([key, item]) => (
                <div
                  key={key}
                  className={`goal-option ${formData.objetivo === key ? "selected" : ""}`}
                  onClick={() => setFormData({ ...formData, objetivo: key })}
                >
                  <div className="goal-head">
                    <b>{item.etiqueta}</b>
                    <span>{item.ajusteKcal >= 0 ? "+" : ""}{item.ajusteKcal} kcal</span>
                  </div>
                  <small>{item.descripcion}</small>
                </div>
              ))}
            </div>
          </div>

          {/* Restricciones alimentarias */}
          <div className="form-field">
            <label>Restricciones o Preferencias Alimentarias (opcional)</label>
            <textarea
              rows="2"
              placeholder="ej. Vegetariano, intolerancia a la lactosa, bajo en sodio..."
              value={formData.restricciones}
              onChange={(e) => setFormData({ ...formData, restricciones: e.target.value })}
            />
          </div>

          <button type="submit" className="primary full-width" disabled={guardandoPerfil}>
            {guardandoPerfil ? "Guardando cambios…" : "Guardar Perfil y Recalcular Metas"}
          </button>
        </form>
      </section>

      {/* Sincronización y Mantenimiento */}
      <section className="profile-tools-card">
        <div className="card-header-styled">
          <div>
            <span className="eyebrow">Base de Datos</span>
            <h3>Sincronización y Comidas</h3>
          </div>
        </div>
        <p className="tools-desc">
          Tus datos se guardan de forma instantánea y persistente. Puedes vincular los registros históricos de comida al perfil activo.
        </p>
        <div className="tools-actions">
          <button type="button" className="secondary-action-btn" onClick={manejarAsociarComidas}>
            🔗 Asociar comidas anteriores a mi perfil
          </button>
          <button
            type="button"
            className="secondary-action-btn"
            onClick={() => setMostrarSql(!mostrarSql)}
          >
            {mostrarSql ? "Ocultar script SQL Supabase" : "📄 Ver Script SQL de Tablas"}
          </button>
        </div>

        {mostrarSql && (
          <div className="sql-box">
            <small>Copia y ejecuta este script en el <b>SQL Editor de Supabase</b> si deseas sincronizar perfiles y pesos en la nube:</small>
            <pre>
{`-- Ejecutar en Supabase SQL Editor:
create table if not exists perfil_datos (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references perfiles(id) on delete cascade unique,
  sexo text not null default 'masculino',
  fecha_nacimiento date default '1995-01-01',
  altura_cm numeric not null default 175,
  nivel_actividad text not null default 'moderado',
  objetivo text not null default 'mantener',
  restricciones text,
  zona_horaria text default 'America/Argentina/Buenos_Aires',
  updated_at timestamp with time zone default now()
);

create table if not exists peso_registros (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references perfiles(id) on delete cascade,
  peso_kg numeric not null,
  fecha date not null default current_date,
  nota text,
  created_at timestamp with time zone default now()
);

alter table perfil_datos enable row level security;
alter table peso_registros enable row level security;
create policy "Permitir todo anon en perfil_datos" on perfil_datos for all using (true) with check (true);
create policy "Permitir todo anon en peso_registros" on peso_registros for all using (true) with check (true);`}
            </pre>
          </div>
        )}
      </section>
    </div>
  );
}

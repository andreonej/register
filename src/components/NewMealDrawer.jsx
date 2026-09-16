import { useState, useRef } from "react";
import { analizarFotoComida } from "../services/gemini";
import { isGeminiConfigured } from "../config";

export const EJEMPLO_REGISTRO = `{
  "comida_nombre": "Ensalada de lentejas",
  "fecha": "2026-09-02 12:30",
  "ingredientes": [{ "nombre": "Lentejas cocidas", "peso_estimado_g": 150, "calorias": 170, "proteinas_g": 12, "carbohidratos_g": 28, "grasas_g": 1, "supuesto": false }],
  "totales_plato": { "calorias": 170, "proteinas_g": 12, "carbohidratos_g": 28, "grasas_g": 1 },
  "nivel_confianza": "Alto"
}`;

/**
 * Optimiza y comprime una imagen seleccionada para envío rápido a la API.
 */
function procesarImagen(file, maxDimension = 1280, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo de imagen"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("No se pudo procesar la imagen seleccionada"));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        const base64Data = dataUrl.split(",")[1];
        resolve({ dataUrl, base64Data, mimeType: "image/jpeg" });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export function NewMealDrawer({
  abierto,
  texto,
  mensaje,
  guardando,
  onTexto,
  onCerrar,
  onGuardar
}) {
  const [pestana, setPestana] = useState("foto"); // "foto" | "json"
  const [imagenPreview, setImagenPreview] = useState(null);
  const [imagenDatos, setImagenDatos] = useState(null);
  const [analizando, setAnalizando] = useState(false);
  const [resultadoIa, setResultadoIa] = useState(null);
  const [errorLocal, setErrorLocal] = useState(null);

  const inputCamaraRef = useRef(null);
  const inputGaleriaRef = useRef(null);

  if (!abierto) return null;

  async function manejarArchivo(evento) {
    const archivo = evento.target.files?.[0];
    if (!archivo) return;
    setErrorLocal(null);
    setResultadoIa(null);
    try {
      const procesada = await procesarImagen(archivo);
      setImagenPreview(procesada.dataUrl);
      setImagenDatos(procesada);
    } catch (err) {
      setErrorLocal("Error al cargar la imagen: " + err.message);
    }
  }

  async function ejecutarAnalisis() {
    if (!imagenDatos) return;
    setAnalizando(true);
    setErrorLocal(null);
    try {
      const resultado = await analizarFotoComida({
        base64Data: imagenDatos.base64Data,
        mimeType: imagenDatos.mimeType
      });
      setResultadoIa(resultado);
    } catch (err) {
      setErrorLocal(err.message);
    } finally {
      setAnalizando(false);
    }
  }

  function editarEnJson() {
    if (resultadoIa) {
      onTexto(JSON.stringify(resultadoIa, null, 2));
    }
    setPestana("json");
  }

  function reiniciarFoto() {
    setImagenPreview(null);
    setImagenDatos(null);
    setResultadoIa(null);
    setErrorLocal(null);
  }

  function guardarResultadoIa() {
    if (resultadoIa) {
      onGuardar(resultadoIa);
    }
  }

  return (
    <div className="drawer-wrap">
      <div className="drawer photo-drawer">
        <div className="drawer-header">
          <h2>Cargar comida</h2>
          <button className="drawer-close" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </div>

        {/* Selector de modo */}
        <div className="drawer-tabs">
          <button
            type="button"
            className={`tab-button ${pestana === "foto" ? "active" : ""}`}
            onClick={() => setPestana("foto")}
          >
            📸 Foto con IA
          </button>
          <button
            type="button"
            className={`tab-button ${pestana === "json" ? "active" : ""}`}
            onClick={() => setPestana("json")}
          >
            📝 Manual (JSON)
          </button>
        </div>

        {/* Inputs ocultos para cámara y galería */}
        <input
          ref={inputCamaraRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={manejarArchivo}
        />
        <input
          ref={inputGaleriaRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={manejarArchivo}
        />

        {pestana === "foto" && (
          <div className="tab-content photo-tab">
            {!isGeminiConfigured && (
              <div className="gemini-warning">
                ⚠️ No se detectó la clave de Gemini en <code>.env</code> (VITE_API_GEMINI).
              </div>
            )}

            {!imagenPreview ? (
              <div className="photo-picker-zone">
                <div className="photo-picker-icon">🍲</div>
                <p className="photo-picker-prompt">
                  Saca una foto a tu plato o elígela de tu galería. Nuestro agente estimará automáticamente los ingredientes, porciones y calorías.
                </p>
                <div className="photo-picker-actions">
                  <button
                    type="button"
                    className="button-camera"
                    onClick={() => inputCamaraRef.current?.click()}
                  >
                    📷 Tomar foto
                  </button>
                  <button
                    type="button"
                    className="button-gallery"
                    onClick={() => inputGaleriaRef.current?.click()}
                  >
                    🖼️ Subir imagen
                  </button>
                </div>
              </div>
            ) : (
              <div className="photo-active-view">
                <div className="photo-thumbnail-box">
                  <img src={imagenPreview} alt="Foto de la comida" className="photo-thumbnail" />
                  <button
                    type="button"
                    className="photo-retake-btn"
                    onClick={reiniciarFoto}
                    title="Elegir otra foto"
                  >
                    🔄 Cambiar foto
                  </button>
                </div>

                {!resultadoIa && !analizando && (
                  <button
                    type="button"
                    className="primary analyze-btn"
                    onClick={ejecutarAnalisis}
                    disabled={!isGeminiConfigured}
                  >
                    ✨ Analizar plato con IA
                  </button>
                )}

                {analizando && (
                  <div className="analyzing-status">
                    <div className="ai-spinner" />
                    <p className="analyzing-title">Analizando tu comida con Gemini...</p>
                    <small>Estimando alimentos, porciones y balance de macronutrientes</small>
                  </div>
                )}

                {resultadoIa && (
                  <div className="ia-result-card">
                    <div className="ia-result-header">
                      <div>
                        <h3>{resultadoIa.comida_nombre}</h3>
                        {resultadoIa.resumen && <p className="ia-summary">{resultadoIa.resumen}</p>}
                      </div>
                      <span className={`confidence-tag confidence-${resultadoIa.nivel_confianza?.toLowerCase()}`}>
                        {resultadoIa.nivel_confianza}
                      </span>
                    </div>

                    {/* Macros pills */}
                    <div className="ia-macros-pills">
                      <div className="macro-pill pill-cals">
                        <strong>{resultadoIa.totales_plato?.calorias ?? 0}</strong>
                        <span>kcal</span>
                      </div>
                      <div className="macro-pill pill-prot">
                        <strong>{resultadoIa.totales_plato?.proteinas_g ?? 0}g</strong>
                        <span>Prot</span>
                      </div>
                      <div className="macro-pill pill-carbs">
                        <strong>{resultadoIa.totales_plato?.carbohidratos_g ?? 0}g</strong>
                        <span>Carb</span>
                      </div>
                      <div className="macro-pill pill-fat">
                        <strong>{resultadoIa.totales_plato?.grasas_g ?? 0}g</strong>
                        <span>Grasa</span>
                      </div>
                    </div>

                    {/* Desglose de ingredientes */}
                    {resultadoIa.ingredientes && resultadoIa.ingredientes.length > 0 && (
                      <div className="ia-ingredients-list">
                        <small className="ingredients-title">Ingredientes detectados:</small>
                        <ul>
                          {resultadoIa.ingredientes.map((ing, idx) => (
                            <li key={idx}>
                              <span>
                                {ing.nombre}
                                {ing.supuesto && <em className="supuesto-badge"> (supuesto)</em>}
                              </span>
                              <b>{ing.peso_estimado_g ? `${ing.peso_estimado_g}g` : ""} · {ing.calorias ?? 0} kcal</b>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Botones de acción del resultado */}
                    <div className="ia-actions">
                      <button
                        type="button"
                        className="primary save-ia-btn"
                        onClick={guardarResultadoIa}
                        disabled={guardando}
                      >
                        {guardando ? "Guardando en BD…" : "💾 Guardar en Base de Datos"}
                      </button>
                      <button
                        type="button"
                        className="secondary edit-json-btn"
                        onClick={editarEnJson}
                      >
                        ✏️ Editar JSON
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {errorLocal && <p className="message error">{errorLocal}</p>}
          </div>
        )}

        {pestana === "json" && (
          <div className="tab-content json-tab">
            <textarea
              value={texto}
              onChange={(evento) => onTexto(evento.target.value)}
              placeholder={EJEMPLO_REGISTRO}
              rows="9"
            />
            <div className="actions">
              <button type="button" onClick={onCerrar}>Cancelar</button>
              <button
                type="button"
                className="primary"
                onClick={() => onGuardar()}
                disabled={guardando || !texto.trim()}
              >
                {guardando ? "Guardando…" : "Guardar comida"}
              </button>
            </div>
          </div>
        )}

        {mensaje && <p className={`message ${mensaje.tipo}`}>{mensaje.texto}</p>}
      </div>
    </div>
  );
}

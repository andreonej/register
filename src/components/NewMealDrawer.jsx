import { useState, useRef, useEffect } from "react";
import {
  analizarFotoComida,
  analizarTextoComida,
  obtenerModeloSeleccionado,
  guardarModeloSeleccionado
} from "../services/gemini";
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

function formatoConfianza(nivel) {
  const valor = nivel ? String(nivel).trim().toLocaleLowerCase("es-AR") : "medio";
  const etiquetas = { alto: "alta", medio: "media", bajo: "baja", alta: "alta", media: "media", baja: "baja" };
  return `Confianza: ${etiquetas[valor] || "media"}`;
}

export function escalarResultado(resultado, factor) {
  if (!resultado) return resultado;
  const escalar = (valor) => Number(valor || 0) * factor;
  return {
    ...resultado,
    totales_plato: Object.fromEntries(Object.entries(resultado.totales_plato || {}).map(([clave, valor]) => [clave, escalar(valor)])),
    ingredientes: (resultado.ingredientes || []).map((ingrediente) => ({
      ...ingrediente,
      peso_estimado_g: escalar(ingrediente.peso_estimado_g),
      calorias: escalar(ingrediente.calorias),
      proteinas_g: escalar(ingrediente.proteinas_g),
      carbohidratos_g: escalar(ingrediente.carbohidratos_g),
      grasas_g: escalar(ingrediente.grasas_g)
    }))
  };
}

function totalesDeIngredientes(ingredientes) {
  return ingredientes.reduce((totales, ingrediente) => ({
    calorias: totales.calorias + Number(ingrediente.calorias || 0),
    proteinas_g: totales.proteinas_g + Number(ingrediente.proteinas_g || 0),
    carbohidratos_g: totales.carbohidratos_g + Number(ingrediente.carbohidratos_g || 0),
    grasas_g: totales.grasas_g + Number(ingrediente.grasas_g || 0)
  }), { calorias: 0, proteinas_g: 0, carbohidratos_g: 0, grasas_g: 0 });
}

export function cambiarGramosResultado(resultado, indice, gramos) {
  if (!resultado) return resultado;
  const ingredientes = [...(resultado.ingredientes || [])];
  const anterior = ingredientes[indice];
  if (!anterior) return resultado;
  const gramosPrevios = Number(anterior.peso_estimado_g || 0);
  const escala = gramosPrevios > 0 ? gramos / gramosPrevios : 0;
  ingredientes[indice] = {
    ...anterior,
    peso_estimado_g: gramos,
    calorias: Number(anterior.calorias || 0) * escala,
    proteinas_g: Number(anterior.proteinas_g || 0) * escala,
    carbohidratos_g: Number(anterior.carbohidratos_g || 0) * escala,
    grasas_g: Number(anterior.grasas_g || 0) * escala
  };
  return { ...resultado, ingredientes, totales_plato: totalesDeIngredientes(ingredientes) };
}

function IngredientsEditor({ ingredientes = [], onNombre, onGramos, onEliminar, onAgregar }) {
  return (
    <div className="ingredient-editor">
      {ingredientes.map((ingrediente, indice) => (
        <div className="ingredient-editor-row" key={`${indice}-${ingrediente.nombre}`}>
          <div className="ingredient-editor-fields">
            <label>
              <span>Ingrediente</span>
              <input value={ingrediente.nombre || ""} onChange={(evento) => onNombre(indice, evento.target.value)} />
            </label>
            <div className="ingredient-grams-control">
              <span>Gramos</span>
              <div>
                <button type="button" aria-label={`Restar un gramo a ${ingrediente.nombre || "ingrediente"}`} onClick={() => onGramos(indice, Math.max(0, Math.round(Number(ingrediente.peso_estimado_g || 0)) - 1))}>−</button>
                <input type="number" min="0" step="1" value={Math.round(Number(ingrediente.peso_estimado_g || 0))} onChange={(evento) => onGramos(indice, Math.max(0, Number(evento.target.value) || 0))} />
                <button type="button" aria-label={`Sumar un gramo a ${ingrediente.nombre || "ingrediente"}`} onClick={() => onGramos(indice, Math.round(Number(ingrediente.peso_estimado_g || 0)) + 1)}>+</button>
              </div>
            </div>
          </div>
          <div className="ingredient-editor-footer">
            <span>{Math.round(Number(ingrediente.calorias || 0))} kcal estimadas</span>
            <button type="button" className="ingredient-remove-button" aria-label={`Quitar ${ingrediente.nombre || "ingrediente"}`} onClick={() => onEliminar(indice)}>Quitar</button>
          </div>
        </div>
      ))}
      <button type="button" className="ingredient-add-button" onClick={onAgregar}>+ Añadir ingrediente</button>
    </div>
  );
}

function PortionSelector({ seleccion, onSeleccionar, onPersonalizar }) {
  const opciones = [
    { id: "todo", texto: "Todo", factor: 1 },
    { id: "mitad", texto: "Mitad", factor: 0.5 },
    { id: "tercio", texto: "1/3", factor: 1 / 3 }
  ];
  return (
    <fieldset className="portion-selector">
      <legend>¿Cuánto comiste?</legend>
      <div className="portion-options">
        {opciones.map((opcion) => (
          <button key={opcion.id} type="button" className={seleccion === opcion.id ? "selected" : ""} aria-pressed={seleccion === opcion.id} onClick={() => onSeleccionar(opcion.id, opcion.factor)}>
            {opcion.texto}
          </button>
        ))}
        <button type="button" className={seleccion === "personalizado" ? "selected" : ""} aria-pressed={seleccion === "personalizado"} onClick={onPersonalizar}>Personalizado</button>
      </div>
    </fieldset>
  );
}

export function NewMealDrawer({
  abierto,
  texto,
  mensaje,
  guardando,
  modeloActivo: modeloProp,
  onCambiarModelo,
  onTexto,
  onCerrar,
  onGuardar
}) {
  const [pestana, setPestana] = useState("foto"); // "foto" | "texto" | "json"
  
  // Estado para modo Foto
  const [imagenPreview, setImagenPreview] = useState(null);
  const [imagenDatos, setImagenDatos] = useState(null);
  const [detallesAdicionales, setDetallesAdicionales] = useState("");
  const [analizando, setAnalizando] = useState(false);
  const [resultadoIa, setResultadoIa] = useState(null);
  const [porcionFoto, setPorcionFoto] = useState("todo");
  const [factorFoto, setFactorFoto] = useState(1);
  const [editorFotoAbierto, setEditorFotoAbierto] = useState(false);
  const [errorLocal, setErrorLocal] = useState(null);

  // Estado para modo Descripción en Texto
  const [descripcionTexto, setDescripcionTexto] = useState("");
  const [detallesTexto, setDetallesTexto] = useState("");
  const [analizandoTexto, setAnalizandoTexto] = useState(false);
  const [resultadoIaTexto, setResultadoIaTexto] = useState(null);
  const [porcionTexto, setPorcionTexto] = useState("todo");
  const [factorTexto, setFactorTexto] = useState(1);
  const [editorTextoAbierto, setEditorTextoAbierto] = useState(false);
  const [errorTexto, setErrorTexto] = useState(null);
  const [fotoAmpliada, setFotoAmpliada] = useState(false);

  const [modeloActual, setModeloActual] = useState(modeloProp || obtenerModeloSeleccionado);

  const inputCamaraRef = useRef(null);
  const inputGaleriaRef = useRef(null);

  // Sincronizar con el modelo activo global cada vez que se abre el drawer o cambia la prop
  useEffect(() => {
    if (abierto) {
      setModeloActual(modeloProp || obtenerModeloSeleccionado());
    }
  }, [abierto, modeloProp]);

  function manejarCambioModelo(nuevoModelo) {
    setModeloActual(nuevoModelo);
    guardarModeloSeleccionado(nuevoModelo);
    if (onCambiarModelo) {
      onCambiarModelo(nuevoModelo);
    }
  }

  if (!abierto) return null;

  const SUGERENCIAS_FOTO = [
    "Frito en aceite",
    "Hecho al horno",
    "A la plancha",
    "Aceite de oliva (1 cda)",
    "Sin aceite añadido",
    "Con salsa / mayonesa",
    "Con queso",
    "Leche descremada"
  ];

  const SUGERENCIAS_TEXTO = [
    "🥪 Sándwich de milanesa con lechuga y tomate",
    "🥜 Puñado de nueces y almendras (30g)",
    "☕ Café cortado con 1 medialuna",
    "🥟 2 empanadas de carne al horno",
    "🍕 2 porciones de pizza muzzarella",
    "🥗 Ensalada de atún, huevo y tomate",
    "🍎 1 manzana mediana",
    "🥤 Vaso de gaseosa zero",
    "🍫 Barrita de cereal",
    "🍗 Pechuga de pollo grillada con arroz"
  ];

  function agregarSugerenciaFoto(sug) {
    setDetallesAdicionales((prev) => {
      const limpia = prev.trim();
      if (!limpia) return sug;
      if (limpia.toLowerCase().includes(sug.toLowerCase())) return limpia;
      return `${limpia}, ${sug}`;
    });
  }

  function agregarSugerenciaTexto(sug) {
    setDescripcionTexto((prev) => {
      const limpia = prev.trim();
      if (!limpia) return sug;
      if (limpia.toLowerCase().includes(sug.toLowerCase())) return limpia;
      return `${limpia} + ${sug}`;
    });
  }

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

  async function ejecutarAnalisisFoto(modeloForzado = null) {
    if (!imagenDatos) return;
    const modeloUsar = modeloForzado || modeloActual;
    if (modeloForzado) {
      manejarCambioModelo(modeloForzado);
    }
    setAnalizando(true);
    setErrorLocal(null);
    try {
      const resultado = await analizarFotoComida({
        base64Data: imagenDatos.base64Data,
        mimeType: imagenDatos.mimeType,
        detallesAdicionales,
        modelo: modeloUsar
      });
      setResultadoIa(resultado);
      setPorcionFoto("todo");
      setFactorFoto(1);
      setEditorFotoAbierto(false);
    } catch (err) {
      setErrorLocal(err.message);
    } finally {
      setAnalizando(false);
    }
  }

  async function ejecutarAnalisisTexto(modeloForzado = null) {
    if (!descripcionTexto.trim()) {
      setErrorTexto("Por favor escribe qué comiste o tomaste.");
      return;
    }
    const modeloUsar = modeloForzado || modeloActual;
    if (modeloForzado) {
      manejarCambioModelo(modeloForzado);
    }
    setAnalizandoTexto(true);
    setErrorTexto(null);
    try {
      const resultado = await analizarTextoComida({
        descripcion: descripcionTexto,
        detallesAdicionales: detallesTexto,
        modelo: modeloUsar
      });
      setResultadoIaTexto(resultado);
      setPorcionTexto("todo");
      setFactorTexto(1);
      setEditorTextoAbierto(false);
    } catch (err) {
      setErrorTexto(err.message);
    } finally {
      setAnalizandoTexto(false);
    }
  }

  function reiniciarFoto() {
    setImagenPreview(null);
    setImagenDatos(null);
    setResultadoIa(null);
    setPorcionFoto("todo");
    setFactorFoto(1);
    setEditorFotoAbierto(false);
    setDetallesAdicionales("");
    setErrorLocal(null);
  }

  function reiniciarTexto() {
    setResultadoIaTexto(null);
    setPorcionTexto("todo");
    setFactorTexto(1);
    setEditorTextoAbierto(false);
    setErrorTexto(null);
  }

  function aplicarPorcionFoto(tipo, factor) {
    setResultadoIa((actual) => escalarResultado(actual, factor / factorFoto));
    setFactorFoto(factor);
    setPorcionFoto(tipo);
  }

  function aplicarPorcionTexto(tipo, factor) {
    setResultadoIaTexto((actual) => escalarResultado(actual, factor / factorTexto));
    setFactorTexto(factor);
    setPorcionTexto(tipo);
  }

  function actualizarGramosFoto(indice, gramos) {
    setResultadoIa((actual) => cambiarGramosResultado(actual, indice, gramos));
  }

  function actualizarGramosTexto(indice, gramos) {
    setResultadoIaTexto((actual) => cambiarGramosResultado(actual, indice, gramos));
  }

  function actualizarNombre(setResultado, indice, nombre) {
    setResultado((actual) => {
      if (!actual) return actual;
      const ingredientes = [...(actual.ingredientes || [])];
      ingredientes[indice] = { ...ingredientes[indice], nombre };
      return { ...actual, ingredientes };
    });
  }

  function quitarIngrediente(setResultado, indice) {
    setResultado((actual) => {
      if (!actual) return actual;
      const ingredientes = (actual.ingredientes || []).filter((_, posicion) => posicion !== indice);
      return { ...actual, ingredientes, totales_plato: totalesDeIngredientes(ingredientes) };
    });
  }

  function agregarIngrediente(setResultado) {
    setResultado((actual) => {
      if (!actual) return actual;
      const ingredientes = [...(actual.ingredientes || []), {
        nombre: "Nuevo ingrediente",
        peso_estimado_g: 100,
        calorias: 0,
        proteinas_g: 0,
        carbohidratos_g: 0,
        grasas_g: 0,
        supuesto: false
      }];
      return { ...actual, ingredientes, totales_plato: totalesDeIngredientes(ingredientes) };
    });
  }

  function guardarResultadoFoto() {
    if (resultadoIa) {
      onGuardar({ ...resultadoIa, factor_porcion: factorFoto, foto: imagenDatos ? { base64Data: imagenDatos.base64Data, mimeType: imagenDatos.mimeType } : null });
    }
  }

  function guardarResultadoTexto() {
    if (resultadoIaTexto) {
      onGuardar({ ...resultadoIaTexto, factor_porcion: factorTexto, foto: null });
    }
  }

  return (
    <div className="drawer-wrap">
      <div className={`drawer photo-drawer ${resultadoIa || resultadoIaTexto ? "analysis-result-drawer" : ""}`}>
        <div className="drawer-header">
          <h2>Cargar comida</h2>
          <button className="drawer-close" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </div>

        {/* Selector de modo: 3 opciones */}
        <div className="drawer-tabs">
          <button
            type="button"
            className={`tab-button ${pestana === "foto" ? "active" : ""}`}
            onClick={() => setPestana("foto")}
          >
            📸 Foto
          </button>
          <button
            type="button"
            className={`tab-button ${pestana === "texto" ? "active" : ""}`}
            onClick={() => setPestana("texto")}
          >
            ✍️ Describir
          </button>
          <button
            type="button"
            className={`tab-button ${pestana === "json" ? "active" : ""}`}
            onClick={() => setPestana("json")}
          >
            📝 Manual
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

        {/* ========================================================= */}
        {/* PESTAÑA 1: FOTO CON IA                                    */}
        {/* ========================================================= */}
        {pestana === "foto" && (
          <div className="tab-content photo-tab">
            {!isGeminiConfigured && (
              <div className="gemini-warning">
                ⚠️ El análisis no está disponible. Revisá Ajustes avanzados.
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
                <div className={`photo-thumbnail-box ${resultadoIa ? "photo-result-preview" : ""}`}>
                  <button type="button" className="photo-preview-button" onClick={() => setFotoAmpliada(true)} aria-label="Ampliar foto de la comida">
                    <img src={imagenPreview} alt="Foto de la comida" className="photo-thumbnail" />
                  </button>
                  <button
                    type="button"
                    className="photo-retake-btn"
                    onClick={reiniciarFoto}
                    title="Elegir otra foto"
                  >
                    🔄 Cambiar foto
                  </button>
                </div>

                <details className="hints-card correction-controls" open={!resultadoIa}>
                  <summary>{resultadoIa ? "¿Corregir algo?" : "Agregar instrucciones (opcional)"}</summary>
                  <label className="hints-label">
                    <span>💡 Instrucciones o ingredientes ocultos (opcional)</span>
                  </label>
                  <textarea
                    className="hints-textarea"
                    rows="2"
                    placeholder="Ej: Milanesa frita en aceite de girasol; ensalada con 1 cda de aceite de oliva; al horno sin grasa..."
                    value={detallesAdicionales}
                    onChange={(e) => setDetallesAdicionales(e.target.value)}
                  />
                  <div className="chips-cloud">
                    {SUGERENCIAS_FOTO.map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        className="chip-btn"
                        onClick={() => agregarSugerenciaFoto(sug)}
                      >
                        ＋ {sug}
                      </button>
                    ))}
                  </div>
                  {resultadoIa && (
                    <button
                      type="button"
                      className="secondary-reanalyze-btn"
                      onClick={() => ejecutarAnalisisFoto()}
                      disabled={!isGeminiConfigured || !detallesAdicionales.trim()}
                    >
                      Volver a analizar
                    </button>
                  )}
                </details>

                {!resultadoIa && !analizando && (
                  <button
                    type="button"
                    className="primary analyze-btn"
                    onClick={() => ejecutarAnalisisFoto()}
                    disabled={!isGeminiConfigured}
                  >
                    Analizar plato
                  </button>
                )}

                {analizando && (
                  <div className="analyzing-status">
                    <div className="ai-spinner" />
                    <p className="analyzing-title">Analizando tu plato...</p>
                    <small>Integrando ingredientes visibles, supuestos e instrucciones</small>
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
                        {formatoConfianza(resultadoIa.nivel_confianza)}
                      </span>
                    </div>

                    <PortionSelector
                      seleccion={porcionFoto}
                      onSeleccionar={aplicarPorcionFoto}
                      onPersonalizar={() => { setPorcionFoto("personalizado"); setEditorFotoAbierto(true); }}
                    />

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

                    {editorFotoAbierto && (
                      <IngredientsEditor
                        ingredientes={resultadoIa.ingredientes || []}
                        onNombre={(indice, nombre) => actualizarNombre(setResultadoIa, indice, nombre)}
                        onGramos={actualizarGramosFoto}
                        onEliminar={(indice) => quitarIngrediente(setResultadoIa, indice)}
                        onAgregar={() => agregarIngrediente(setResultadoIa)}
                      />
                    )}

                    {/* Botones de acción del resultado */}
                    <div className="ia-actions">
                      <button
                        type="button"
                        className="primary save-ia-btn"
                        onClick={guardarResultadoFoto}
                        disabled={guardando}
                      >
                        {guardando ? "Guardando…" : "Guardar comida"}
                      </button>
                      <button
                        type="button"
                        className="secondary edit-ingredients-btn"
                        onClick={() => setEditorFotoAbierto((abiertoActual) => !abiertoActual)}
                        aria-expanded={editorFotoAbierto}
                      >
                        {editorFotoAbierto ? "Listo" : "Editar ingredientes"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {errorLocal && (
              <div className="error-recovery-box">
                <p className="message error">{errorLocal}</p>
                <div className="error-switch-options">
                  <small>¿Querés probar otra opción? También podés cambiarla en Ajustes avanzados.</small>
                  <div className="error-quick-chips">
                    {modeloActual !== "gemini-2.0-flash" && (
                      <button
                        type="button"
                        className="error-switch-chip"
                        onClick={() => ejecutarAnalisisFoto("gemini-2.0-flash")}
                        disabled={analizando}
                      >
                        Probar otra opción disponible
                      </button>
                    )}
                    {modeloActual !== "gemini-1.5-flash" && (
                      <button
                        type="button"
                        className="error-switch-chip"
                        onClick={() => ejecutarAnalisisFoto("gemini-1.5-flash")}
                        disabled={analizando}
                      >
                        Probar una opción alternativa
                      </button>
                    )}
                    {modeloActual !== "gemini-3.7-flash" && modeloActual !== "gemini-3.6-flash" && (
                      <button
                        type="button"
                        className="error-switch-chip"
                        onClick={() => ejecutarAnalisisFoto("gemini-3.7-flash")}
                        disabled={analizando}
                      >
                        Probar otra opción
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* PESTAÑA 2: DESCRIBIR CON IA (TEXTO LIBRE)                */}
        {/* ========================================================= */}
        {pestana === "texto" && (
          <div className="tab-content text-tab">
            {!isGeminiConfigured && (
              <div className="gemini-warning">
                ⚠️ El análisis no está disponible. Revisá Ajustes avanzados.
              </div>
            )}

            {!resultadoIaTexto ? (
              <div className="text-prompt-box">
                <div className="text-prompt-intro">
                  <div className="text-prompt-icon">💬</div>
                  <div>
                    <h3 className="text-prompt-title">Describe lo que consumiste</h3>
                    <p className="text-prompt-sub">
                      Ideal para cuando estás en la calle o sin foto. La IA estimará porciones, ingredientes y calorías estimadas.
                    </p>
                  </div>
                </div>

                <div className="hints-card" style={{ marginBottom: "12px" }}>
                  <label className="hints-label">
                    <span>✍️ ¿Qué comiste o tomaste?</span>
                  </label>
                  <textarea
                    className="hints-textarea text-main-textarea"
                    rows="3"
                    placeholder="Ej: Me comí un sanguche de milanesa con lechuga, tomate y mayonesa en pan francés, y un café cortado..."
                    value={descripcionTexto}
                    onChange={(e) => setDescripcionTexto(e.target.value)}
                    disabled={analizandoTexto}
                    autoFocus
                  />
                  <div className="chips-section-title">
                    <small>💡 Opciones y atajos frecuentes:</small>
                  </div>
                  <div className="chips-cloud">
                    {SUGERENCIAS_TEXTO.map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        className="chip-btn"
                        onClick={() => agregarSugerenciaTexto(sug)}
                        disabled={analizandoTexto}
                      >
                        ＋ {sug}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="hints-card" style={{ marginBottom: "14px" }}>
                  <label className="hints-label">
                    <span>💡 Aclaraciones o detalles extra (opcional)</span>
                  </label>
                  <input
                    type="text"
                    className="text-inline-input"
                    placeholder="Ej: Frito en abundante aceite; edulcorante en lugar de azúcar; porción grande..."
                    value={detallesTexto}
                    onChange={(e) => setDetallesTexto(e.target.value)}
                    disabled={analizandoTexto}
                  />
                </div>

                {!analizandoTexto && (
                  <button
                    type="button"
                    className="primary analyze-btn"
                    onClick={() => ejecutarAnalisisTexto()}
                    disabled={!isGeminiConfigured || !descripcionTexto.trim()}
                  >
                      Estimar comida
                  </button>
                )}

                {analizandoTexto && (
                  <div className="analyzing-status">
                    <div className="ai-spinner" />
                    <p className="analyzing-title">Estimando tu comida...</p>
                    <small>Desglosando alimentos en ingredientes, calculando porciones y nutrientes</small>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-active-view has-result">
                <div className="text-query-bubble">
                  <div className="query-label">
                    <span>💬 Descripción ingresada</span>
                    <button
                      type="button"
                      className="text-tweak-btn"
                      onClick={reiniciarTexto}
                      title="Editar descripción"
                    >
                      ✏️ Cambiar texto
                    </button>
                  </div>
                  <p className="query-content">“{descripcionTexto}”</p>
                  {detallesTexto.trim() && (
                    <p className="query-sub">Detalle: {detallesTexto}</p>
                  )}
                </div>

                {analizandoTexto && (
                  <div className="analyzing-status">
                    <div className="ai-spinner" />
                    <p className="analyzing-title">Volviendo a analizar...</p>
                    <small>Recalculando estimaciones nutricionales</small>
                  </div>
                )}

                {!analizandoTexto && (
                  <div className="ia-result-card">
                    <div className="ia-result-header">
                      <div>
                        <h3>{resultadoIaTexto.comida_nombre}</h3>
                        {resultadoIaTexto.resumen && <p className="ia-summary">{resultadoIaTexto.resumen}</p>}
                      </div>
                    <span className={`confidence-tag confidence-${resultadoIaTexto.nivel_confianza?.toLowerCase()}`}>
                        {formatoConfianza(resultadoIaTexto.nivel_confianza)}
                      </span>
                    </div>

                    <PortionSelector
                      seleccion={porcionTexto}
                      onSeleccionar={aplicarPorcionTexto}
                      onPersonalizar={() => { setPorcionTexto("personalizado"); setEditorTextoAbierto(true); }}
                    />

                    {/* Macros pills */}
                    <div className="ia-macros-pills">
                      <div className="macro-pill pill-cals">
                        <strong>{resultadoIaTexto.totales_plato?.calorias ?? 0}</strong>
                        <span>kcal</span>
                      </div>
                      <div className="macro-pill pill-prot">
                        <strong>{resultadoIaTexto.totales_plato?.proteinas_g ?? 0}g</strong>
                        <span>Prot</span>
                      </div>
                      <div className="macro-pill pill-carbs">
                        <strong>{resultadoIaTexto.totales_plato?.carbohidratos_g ?? 0}g</strong>
                        <span>Carb</span>
                      </div>
                      <div className="macro-pill pill-fat">
                        <strong>{resultadoIaTexto.totales_plato?.grasas_g ?? 0}g</strong>
                        <span>Grasa</span>
                      </div>
                    </div>

                    {/* Desglose de ingredientes */}
                    {resultadoIaTexto.ingredientes && resultadoIaTexto.ingredientes.length > 0 && (
                      <div className="ia-ingredients-list">
                        <small className="ingredients-title">Ingredientes estimados:</small>
                        <ul>
                          {resultadoIaTexto.ingredientes.map((ing, idx) => (
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

                    {editorTextoAbierto && (
                      <IngredientsEditor
                        ingredientes={resultadoIaTexto.ingredientes || []}
                        onNombre={(indice, nombre) => actualizarNombre(setResultadoIaTexto, indice, nombre)}
                        onGramos={actualizarGramosTexto}
                        onEliminar={(indice) => quitarIngrediente(setResultadoIaTexto, indice)}
                        onAgregar={() => agregarIngrediente(setResultadoIaTexto)}
                      />
                    )}

                    {/* Botones de acción del resultado */}
                    <div className="ia-actions">
                      <button
                        type="button"
                        className="primary save-ia-btn"
                        onClick={guardarResultadoTexto}
                        disabled={guardando}
                      >
                        {guardando ? "Guardando…" : "Guardar comida"}
                      </button>
                      <button
                        type="button"
                        className="secondary edit-ingredients-btn"
                        onClick={() => setEditorTextoAbierto((abiertoActual) => !abiertoActual)}
                        aria-expanded={editorTextoAbierto}
                      >
                        {editorTextoAbierto ? "Listo" : "Editar ingredientes"}
                      </button>
                    </div>

                  </div>
                )}

                {!analizandoTexto && (
                  <details className="hints-card correction-controls">
                    <summary>¿Corregir algo?</summary>
                    <label className="hints-label" htmlFor="correccion-descripcion">Descripción de la comida</label>
                    <textarea
                      id="correccion-descripcion"
                      className="hints-textarea"
                      rows="3"
                      value={descripcionTexto}
                      onChange={(e) => setDescripcionTexto(e.target.value)}
                    />
                    <label className="hints-label" htmlFor="correccion-detalles">Aclaraciones (opcional)</label>
                    <textarea
                      id="correccion-detalles"
                      className="hints-textarea"
                      rows="2"
                      placeholder="Ej: era sin mayonesa"
                      value={detallesTexto}
                      onChange={(e) => setDetallesTexto(e.target.value)}
                    />
                    <button
                      type="button"
                      className="secondary-reanalyze-btn"
                      onClick={() => ejecutarAnalisisTexto()}
                      disabled={!isGeminiConfigured || !descripcionTexto.trim()}
                    >
                      Volver a analizar
                    </button>
                  </details>
                )}
              </div>
            )}

            {errorTexto && (
              <div className="error-recovery-box">
                <p className="message error">{errorTexto}</p>
                <div className="error-switch-options">
                  <small>¿Querés probar otra opción? También podés cambiarla en Ajustes avanzados.</small>
                  <div className="error-quick-chips">
                    {modeloActual !== "gemini-2.0-flash" && (
                      <button
                        type="button"
                        className="error-switch-chip"
                        onClick={() => ejecutarAnalisisTexto("gemini-2.0-flash")}
                        disabled={analizandoTexto}
                      >
                        Probar otra opción disponible
                      </button>
                    )}
                    {modeloActual !== "gemini-1.5-flash" && (
                      <button
                        type="button"
                        className="error-switch-chip"
                        onClick={() => ejecutarAnalisisTexto("gemini-1.5-flash")}
                        disabled={analizandoTexto}
                      >
                        Probar una opción alternativa
                      </button>
                    )}
                    {modeloActual !== "gemini-3.7-flash" && modeloActual !== "gemini-3.6-flash" && (
                      <button
                        type="button"
                        className="error-switch-chip"
                        onClick={() => ejecutarAnalisisTexto("gemini-3.7-flash")}
                        disabled={analizandoTexto}
                      >
                        Probar otra opción
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* PESTAÑA 3: MANUAL (JSON)                                  */}
        {/* ========================================================= */}
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

        {fotoAmpliada && imagenPreview && (
          <div className="photo-lightbox" role="dialog" aria-modal="true" aria-label="Foto ampliada" onClick={() => setFotoAmpliada(false)}>
            <button type="button" onClick={() => setFotoAmpliada(false)} aria-label="Cerrar foto ampliada">Cerrar</button>
            <img src={imagenPreview} alt="Foto completa de la comida" />
          </div>
        )}

        {mensaje && <p className={`message ${mensaje.tipo}`}>{mensaje.texto}</p>}
      </div>
    </div>
  );
}

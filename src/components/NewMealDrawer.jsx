import { useState, useRef, useEffect, useLayoutEffect } from "react";
import {
  analizarFotoComida,
  analizarTextoComida,
  obtenerModeloSeleccionado,
  guardarModeloSeleccionado
} from "../services/gemini";
import { isGeminiConfigured } from "../config";

function mensajeErrorVisible(error) {
  return String(error?.message || "No se pudo completar el análisis.")
    .replace(/\bGemini\b/gi, "servicio de análisis")
    .replace(/\bJSON\b/gi, "respuesta estructurada")
    .replace(/\bBase de Datos\b/gi, "servicio")
    .replace(/\s{2,}/g, " ");
}

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

function confianzaNormalizada(valor) {
  const normalizada = String(valor || "media").trim().toLocaleLowerCase("es-AR");
  return ["alta", "media", "baja"].includes(normalizada) ? normalizada : "media";
}

function fechaHoraLocalInput(fecha) {
  const pad = (valor) => String(valor).padStart(2, "0");
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}T${pad(fecha.getHours())}:${pad(fecha.getMinutes())}`;
}

function fechaHoraLegible(valor) {
  if (!valor) return "Ahora";
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? valor : fecha.toLocaleString("es-AR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

function SugerenciasCorreccion({ sugerencias = [], onSeleccionar }) {
  if (!sugerencias.length) return null;
  return (
    <div className="chips-cloud contextual-chips" aria-label="Sugerencias para corregir el análisis">
      {sugerencias.slice(0, 6).map((sugerencia) => (
        <button key={sugerencia} type="button" className="chip-btn" onClick={() => onSeleccionar(sugerencia)}>
          + {sugerencia}
        </button>
      ))}
    </div>
  );
}

function redondear(valor, decimales = 2) {
  const precision = 10 ** decimales;
  return Math.round((Number(valor) + Number.EPSILON) * precision) / precision;
}

export function escalarResultado(resultado, factor) {
  if (!resultado) return resultado;
  const escalar = (valor) => redondear(Number(valor || 0) * factor);
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
  const totales = ingredientes.reduce((acumulado, ingrediente) => ({
    calorias: acumulado.calorias + Number(ingrediente.calorias || 0),
    proteinas_g: acumulado.proteinas_g + Number(ingrediente.proteinas_g || 0),
    carbohidratos_g: acumulado.carbohidratos_g + Number(ingrediente.carbohidratos_g || 0),
    grasas_g: acumulado.grasas_g + Number(ingrediente.grasas_g || 0)
  }), { calorias: 0, proteinas_g: 0, carbohidratos_g: 0, grasas_g: 0 });
  return Object.fromEntries(Object.entries(totales).map(([clave, valor]) => [clave, redondear(valor)]));
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
    calorias: redondear(Number(anterior.calorias || 0) * escala),
    proteinas_g: redondear(Number(anterior.proteinas_g || 0) * escala),
    carbohidratos_g: redondear(Number(anterior.carbohidratos_g || 0) * escala),
    grasas_g: redondear(Number(anterior.grasas_g || 0) * escala)
  };
  return { ...resultado, ingredientes, totales_plato: totalesDeIngredientes(ingredientes) };
}

function cambiarCantidadResultado(resultado, indice, cantidad) {
  if (!resultado) return resultado;
  const ingredientes = [...(resultado.ingredientes || [])];
  const anterior = ingredientes[indice];
  if (!anterior) return resultado;
  const cantidadAnterior = Math.max(1, Number(anterior.cantidad) || 1);
  const cantidadNueva = Math.max(1, Math.round(Number(cantidad) || 1));
  const escala = cantidadNueva / cantidadAnterior;
  ingredientes[indice] = {
    ...anterior,
    cantidad: cantidadNueva,
    peso_estimado_g: redondear(Number(anterior.peso_estimado_g || 0) * escala),
    calorias: redondear(Number(anterior.calorias || 0) * escala),
    proteinas_g: redondear(Number(anterior.proteinas_g || 0) * escala),
    carbohidratos_g: redondear(Number(anterior.carbohidratos_g || 0) * escala),
    grasas_g: redondear(Number(anterior.grasas_g || 0) * escala)
  };
  return { ...resultado, ingredientes, totales_plato: totalesDeIngredientes(ingredientes) };
}

function IngredientsEditor({ ingredientes = [], onNombre, onGramos, onCantidad, onEliminar, onAgregar }) {
  return (
    <div className="ingredient-editor">
      {ingredientes.map((ingrediente, indice) => (
        <div className="ingredient-editor-row" key={indice}>
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
            <div className="ingredient-quantity-control" aria-label={`Cantidad de ${ingrediente.nombre || "ingrediente"}`}>
              <button type="button" aria-label={`Restar una unidad de ${ingrediente.nombre || "ingrediente"}`} onClick={() => onCantidad(indice, Math.max(1, (Number(ingrediente.cantidad) || 1) - 1))}>−</button>
              <span>{Math.max(1, Number(ingrediente.cantidad) || 1)}×</span>
              <button type="button" aria-label={`Sumar una unidad de ${ingrediente.nombre || "ingrediente"}`} onClick={() => onCantidad(indice, (Number(ingrediente.cantidad) || 1) + 1)}>+</button>
            </div>
            <button type="button" className="ingredient-remove-button" aria-label={`Quitar ${ingrediente.nombre || "ingrediente"}`} onClick={() => onEliminar(indice)}>✕</button>
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

function AtajosFrecuentes({ comidas = [], onRegistrar, guardando = false }) {
  const [ajusteActivo, setAjusteActivo] = useState(null);
  const [factorAjuste, setFactorAjuste] = useState(1);
  if (!comidas.length) return null;
  const opcionesPorcion = [[1, "Completa"], [0.75, "3/4"], [0.5, "Mitad"], [1 / 3, "1/3"], [0.25, "1/4"]];
  return (
    <section className="frequent-meals" aria-label="Comidas frecuentes">
      <h4>Tus comidas frecuentes</h4>
      {comidas.map((atajo) => (
        <article className="frequent-meal" key={atajo.clave}>
          <button type="button" className="frequent-meal-register" onClick={() => onRegistrar(atajo.comida, 1)} disabled={guardando}>
            <strong>{atajo.comida.comida_nombre}</strong>
            <span>{Math.round(Number(atajo.comida.calorias_totales || 0))} kcal · {atajo.frecuencia} {atajo.frecuencia === 1 ? "vez" : "veces"} · {atajo.franja.toLocaleLowerCase("es-AR")}</span>
          </button>
          <button
            type="button"
            className="frequent-meal-adjust"
            onClick={() => { setAjusteActivo(ajusteActivo === atajo.clave ? null : atajo.clave); setFactorAjuste(1); }}
            aria-expanded={ajusteActivo === atajo.clave}
            disabled={guardando}
          >
            Ajustar porción
          </button>
          {ajusteActivo === atajo.clave && (
            <div className="frequent-meal-portion">
              <label>
                Porción
                <select value={factorAjuste} onChange={(evento) => setFactorAjuste(Number(evento.target.value))}>
                  {opcionesPorcion.map(([factor, etiqueta]) => <option key={factor} value={factor}>{etiqueta}</option>)}
                </select>
              </label>
              <span>{Math.round(Number(atajo.comida.calorias_totales || 0) * factorAjuste)} kcal estimadas</span>
              <button type="button" className="primary" onClick={() => onRegistrar(atajo.comida, factorAjuste)} disabled={guardando}>Registrar</button>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}

export function NewMealDrawer({
  abierto,
  mensaje,
  guardando,
  modeloActivo: modeloProp,
  onCambiarModelo,
  onCerrar,
  onGuardar,
  accionInicial = null,
  onAccionInicialCompletada,
  comidasFrecuentes = [],
  onRegistrarComida
}) {
  const [pestana, setPestana] = useState("foto"); // "foto" | "texto"
  
  // Estado para modo Foto
  const [imagenPreview, setImagenPreview] = useState(null);
  const [imagenDatos, setImagenDatos] = useState(null);
  const [detallesAdicionales, setDetallesAdicionales] = useState("");
  const [analizando, setAnalizando] = useState(false);
  const [analizandoAutomatico, setAnalizandoAutomatico] = useState(false);
  const [resultadoIa, setResultadoIa] = useState(null);
  const [porcionFoto, setPorcionFoto] = useState("todo");
  const [factorFoto, setFactorFoto] = useState(1);
  const [editorFotoAbierto, setEditorFotoAbierto] = useState(false);
  const [errorLocal, setErrorLocal] = useState(null);

  // Estado para modo Descripción en Texto
  const [descripcionTexto, setDescripcionTexto] = useState("");
  const [detallesTexto, setDetallesTexto] = useState("");
  const [fechaComidaTexto, setFechaComidaTexto] = useState(() => fechaHoraLocalInput(new Date()));
  const [momentoRapido, setMomentoRapido] = useState("ahora");
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
  const drawerAbiertoRef = useRef(false);
  const accionInicialConsumidaRef = useRef(null);
  const analisisFotoControllerRef = useRef(null);

  // Sincronizar con el modelo activo global cada vez que se abre el drawer o cambia la prop
  useEffect(() => {
    if (abierto) {
      setModeloActual(modeloProp || obtenerModeloSeleccionado());
      if (!drawerAbiertoRef.current) {
        setFechaComidaTexto(fechaHoraLocalInput(new Date()));
        setMomentoRapido("ahora");
      }
    }
    drawerAbiertoRef.current = abierto;
  }, [abierto, modeloProp]);

  useEffect(() => {
    if (!abierto) {
      analisisFotoControllerRef.current?.abort();
      analisisFotoControllerRef.current = null;
      return undefined;
    }
    const viewport = window.visualViewport;
    const ajustarAlViewport = () => {
      const alturaVisible = viewport?.height || window.innerHeight;
      const desplazamiento = viewport?.offsetTop || 0;
      const espacioTeclado = Math.max(0, window.innerHeight - alturaVisible - desplazamiento);
      document.documentElement.style.setProperty("--visual-viewport-height", `${alturaVisible}px`);
      document.documentElement.style.setProperty("--keyboard-overlay-height", `${espacioTeclado}px`);
    };
    ajustarAlViewport();
    viewport?.addEventListener("resize", ajustarAlViewport);
    viewport?.addEventListener("scroll", ajustarAlViewport);
    window.addEventListener("resize", ajustarAlViewport);
    return () => {
      viewport?.removeEventListener("resize", ajustarAlViewport);
      viewport?.removeEventListener("scroll", ajustarAlViewport);
      window.removeEventListener("resize", ajustarAlViewport);
      document.documentElement.style.removeProperty("--visual-viewport-height");
      document.documentElement.style.removeProperty("--keyboard-overlay-height");
    };
  }, [abierto]);

  useLayoutEffect(() => {
    if (!accionInicial) {
      accionInicialConsumidaRef.current = null;
      return undefined;
    }
    if (!abierto || accionInicialConsumidaRef.current === accionInicial) return undefined;
    accionInicialConsumidaRef.current = accionInicial;
    if (accionInicial === "describir") {
      setPestana("texto");
      setDescripcionTexto("");
      setDetallesTexto("");
      setResultadoIaTexto(null);
      setFechaComidaTexto(fechaHoraLocalInput(new Date()));
      setMomentoRapido("ahora");
    } else {
      setPestana("foto");
      setImagenPreview(null);
      setImagenDatos(null);
      setResultadoIa(null);
      setErrorLocal(null);
      setAnalizandoAutomatico(accionInicial === "camara");
      if (accionInicial === "camara") inputCamaraRef.current?.click();
      if (accionInicial === "galeria") inputGaleriaRef.current?.click();
    }
    onAccionInicialCompletada?.();
    return undefined;
  }, [abierto, accionInicial]);

  useEffect(() => {
    if (!analizandoAutomatico || !imagenDatos) return;
    setAnalizandoAutomatico(false);
    ejecutarAnalisisFoto();
  }, [analizandoAutomatico, imagenDatos]);

  function manejarCambioModelo(nuevoModelo) {
    setModeloActual(nuevoModelo);
    guardarModeloSeleccionado(nuevoModelo);
    if (onCambiarModelo) {
      onCambiarModelo(nuevoModelo);
    }
  }

  if (!abierto) return null;

  function agregarCorreccion(setDetalles, sugerencia) {
    setDetalles((prev) => {
      const limpia = prev.trim();
      if (limpia.toLocaleLowerCase("es-AR").includes(sugerencia.toLocaleLowerCase("es-AR"))) return limpia;
      return limpia ? `${limpia}; ${sugerencia}` : sugerencia;
    });
  }

  async function manejarArchivo(evento) {
    const archivo = evento.target.files?.[0];
    if (!archivo) return;
    const analizarAlCargar = evento.currentTarget === inputCamaraRef.current;
    evento.target.value = "";
    setErrorLocal(null);
    setResultadoIa(null);
    setAnalizandoAutomatico(analizarAlCargar);
    try {
      const procesada = await procesarImagen(archivo);
      setImagenPreview(procesada.dataUrl);
      setImagenDatos(procesada);
    } catch (err) {
      setAnalizandoAutomatico(false);
      setErrorLocal("Error al cargar la imagen: " + mensajeErrorVisible(err));
    }
  }

  async function ejecutarAnalisisFoto(modeloForzado = null) {
    if (!imagenDatos) return;
    const modeloUsar = modeloForzado || modeloActual;
    if (modeloForzado) {
      manejarCambioModelo(modeloForzado);
    }
    const controller = new AbortController();
    analisisFotoControllerRef.current?.abort();
    analisisFotoControllerRef.current = controller;
    setAnalizando(true);
    setErrorLocal(null);
    try {
      const resultado = await analizarFotoComida({
        base64Data: imagenDatos.base64Data,
        mimeType: imagenDatos.mimeType,
        detallesAdicionales,
        modelo: modeloUsar,
        signal: controller.signal
      });
      setResultadoIa(resultado);
      setPorcionFoto("todo");
      setFactorFoto(1);
      setEditorFotoAbierto(false);
    } catch (err) {
      if (err.name !== "AbortError") setErrorLocal(mensajeErrorVisible(err));
    } finally {
      if (analisisFotoControllerRef.current === controller) analisisFotoControllerRef.current = null;
      setAnalizando(false);
    }
  }

  function cancelarAnalisisFoto() {
    analisisFotoControllerRef.current?.abort();
    analisisFotoControllerRef.current = null;
    setAnalizando(false);
    setAnalizandoAutomatico(false);
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
        fechaComida: fechaComidaTexto.replace("T", " "),
        modelo: modeloUsar
      });
      setResultadoIaTexto(resultado);
      setPorcionTexto("todo");
      setFactorTexto(1);
      setEditorTextoAbierto(false);
    } catch (err) {
      setErrorTexto(mensajeErrorVisible(err));
    } finally {
      setAnalizandoTexto(false);
    }
  }

  function reiniciarFoto() {
    cancelarAnalisisFoto();
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

  function seleccionarMomentoRapido(opcion) {
    const fecha = new Date();
    if (opcion === "hora") fecha.setHours(fecha.getHours() - 1);
    if (opcion === "manana") {
      if (fecha.getHours() < 8) fecha.setDate(fecha.getDate() - 1);
      fecha.setHours(8, 0, 0, 0);
    }
    if (opcion === "mediodia") {
      if (fecha.getHours() < 12) fecha.setDate(fecha.getDate() - 1);
      fecha.setHours(12, 0, 0, 0);
    }
    if (opcion === "anoche") {
      fecha.setDate(fecha.getDate() - 1);
      fecha.setHours(20, 0, 0, 0);
    }
    setMomentoRapido(opcion);
    setFechaComidaTexto(fechaHoraLocalInput(fecha));
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

  function actualizarCantidadFoto(indice, cantidad) {
    setResultadoIa((actual) => cambiarCantidadResultado(actual, indice, cantidad));
  }

  function actualizarCantidadTexto(indice, cantidad) {
    setResultadoIaTexto((actual) => cambiarCantidadResultado(actual, indice, cantidad));
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
      <div className={`drawer photo-drawer ${resultadoIa || resultadoIaTexto ? "analysis-result-drawer" : ""} ${pestana === "texto" && !resultadoIaTexto ? "text-compose-drawer" : ""}`}>
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
        </div>

        {/* Inputs ocultos para cámara y galería */}
        <input
          ref={inputCamaraRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={manejarArchivo}
          onCancel={() => setAnalizandoAutomatico(false)}
        />
        <input
          ref={inputGaleriaRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={manejarArchivo}
          onCancel={() => setAnalizandoAutomatico(false)}
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
                <div className="photo-picker-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.5"/></svg></div>
                <p className="photo-picker-prompt">
                  Saca una foto para comenzar el análisis automáticamente, o elige una imagen de tu galería.
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
                  <SugerenciasCorreccion
                    sugerencias={resultadoIa?.sugerencias_correccion}
                    onSeleccionar={(sugerencia) => agregarCorreccion(setDetallesAdicionales, sugerencia)}
                  />
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
                    <button type="button" className="cancel-analysis-button" onClick={cancelarAnalisisFoto}>Cancelar</button>
                  </div>
                )}

                {resultadoIa && (
                  <div className="ia-result-card">
                    <div className="ia-result-header">
                      <div>
                        <h3>{resultadoIa.comida_nombre}</h3>
                        {resultadoIa.resumen && <p className="ia-summary">{resultadoIa.resumen}</p>}
                      </div>
                      <span className={`confidence-tag confidence-${confianzaNormalizada(resultadoIa.confianza_general || resultadoIa.nivel_confianza)}`}>
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
                                {Number(ing.cantidad) > 1 && <b className="ingredient-count">{ing.cantidad}×</b>}
                                {confianzaNormalizada(ing.confianza) === "baja" && <span className="low-confidence-mark" aria-label="Confianza baja; revisar"><i /> Revisar</span>}
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
                        onCantidad={actualizarCantidadFoto}
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
                      Escribí una frase o una descripción detallada. Estimamos lo que falte y respetamos las cantidades que indiques.
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
                  <AtajosFrecuentes comidas={comidasFrecuentes} onRegistrar={onRegistrarComida} guardando={guardando} />
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

                <fieldset className="meal-time-picker">
                  <legend>¿Cuándo comiste?</legend>
                  <div className="meal-time-options">
                    {[
                      ["ahora", "Ahora"], ["hora", "Hace 1 h"], ["manana", "Esta mañana"],
                      ["mediodia", "Mediodía"], ["anoche", "Anoche"], ["elegir", "Elegir fecha y hora"]
                    ].map(([id, etiqueta]) => (
                      <button
                        key={id}
                        type="button"
                        className={momentoRapido === id || (id === "elegir" && momentoRapido === "personalizado") ? "selected" : ""}
                        aria-pressed={momentoRapido === id || (id === "elegir" && momentoRapido === "personalizado")}
                        onClick={() => id === "elegir" ? setMomentoRapido("elegir") : seleccionarMomentoRapido(id)}
                        disabled={analizandoTexto}
                      >
                        {etiqueta}
                      </button>
                    ))}
                  </div>
                  {(momentoRapido === "elegir" || momentoRapido === "personalizado") && (
                    <input
                      type="datetime-local"
                      aria-label="Elegir fecha y hora de la comida"
                      value={fechaComidaTexto}
                      onChange={(evento) => { setFechaComidaTexto(evento.target.value); setMomentoRapido("personalizado"); }}
                      disabled={analizandoTexto}
                    />
                  )}
                </fieldset>

                <div className="text-analyze-sticky">
                  {!analizandoTexto && (
                    <button
                      type="button"
                      className="primary analyze-btn"
                      onClick={() => ejecutarAnalisisTexto()}
                      disabled={!isGeminiConfigured || !descripcionTexto.trim()}
                    >
                      Analizar
                    </button>
                  )}
                </div>

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
                  <p className="query-sub">Registrada para: {fechaHoraLegible(fechaComidaTexto)}</p>
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
                    <span className={`confidence-tag confidence-${confianzaNormalizada(resultadoIaTexto.confianza_general || resultadoIaTexto.nivel_confianza)}`}>
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
                        <small className="ingredients-title">Ingredientes:</small>
                        <ul>
                          {resultadoIaTexto.ingredientes.map((ing, idx) => (
                            <li key={idx}>
                              <span>
                                {Number(ing.cantidad) > 1 && <b className="ingredient-count">{ing.cantidad}×</b>}
                                {confianzaNormalizada(ing.confianza) === "baja" && <span className="low-confidence-mark" aria-label="Confianza baja; revisar"><i /> Revisar</span>}
                                {ing.nombre}
                                <em className={`ingredient-origin origin-${ing.origen === "usuario" ? "usuario" : "inferido"}`}>{ing.origen === "usuario" ? "indicado" : "estimado"}</em>
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
                        onCantidad={actualizarCantidadTexto}
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
                    <SugerenciasCorreccion
                      sugerencias={resultadoIaTexto.sugerencias_correccion}
                      onSeleccionar={(sugerencia) => agregarCorreccion(setDetallesTexto, sugerencia)}
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

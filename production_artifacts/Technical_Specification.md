# Especificación Técnica: Ocultamiento y Proxy Seguro de Gemini API vía Netlify Functions

**Estado:** En revisión (esperando aprobación del usuario)  
**Autor:** Product Manager & Principal Architect (@pm)  
**Fecha:** 22 de Octubre de 2026  
**Versión:** 1.0.0  

---

## 1. Resumen Ejecutivo

### 1.1 Contexto
Actualmente, la aplicación *Registro de Comidas* realiza las llamadas de inferencia de IA directamente desde el navegador del cliente (`src/services/gemini.js`) hacia la API pública de Google Gemini (`https://generativelanguage.googleapis.com/...`). Para ello, expone la variable de entorno `VITE_API_GEMINI` en el frontend, la cual se compila en texto plano en el bundle de JavaScript y viaja como parámetro query `?key=AIza...` en el monitor de red (Network DevTools).

### 1.2 Objetivo
Eliminar por completo la exposición de la API Key de Gemini en el cliente web mediante la implementación de una **Netlify Function** que actúe como backend proxy seguro y sin servidor (Serverless). La API Key residirá exclusivamente en el entorno del servidor (`process.env.GEMINI_API_KEY`), garantizando que ningún usuario ni inspección de red pueda extraerla.

---

## 2. Requisitos

### 2.1 Requisitos Funcionales
- **RF-01 (Proxy Serverless de Gemini):** Crear un endpoint serverless `POST /.netlify/functions/gemini` que reciba las solicitudes de análisis (foto o texto), inyecte la API Key de forma segura y reenvíe la petición a la API de Google Gemini.
- **RF-02 (Soporte Multimodal y Texto):** El endpoint debe dar soporte tanto al análisis visual de alimentos (imágenes en base64 con `inlineData`) como al análisis descriptivo por texto libre.
- **RF-03 (Selector de Modelos Dinámico):** Permitir especificar el modelo de Gemini solicitado (ej. `gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-1.5-flash`, etc.) dentro de una lista blanca de modelos permitidos.
- **RF-04 (Manejo de Respuestas y Errores):** El proxy debe propagar con claridad los códigos de estado HTTP (429 por saturación de cuota, 400 por payload inválido, 500 por error interno) y la respuesta JSON estructurada de Gemini.
- **RF-05 (Compatibilidad Transparente en Desarrollo Local):** El comando `npm run dev` (Vite) debe seguir funcionando localmente sin requerir obligatoriamente la CLI de Netlify, utilizando un middleware en `vite.config.js` que atienda `/.netlify/functions/gemini` leyendo el `.env` local.

### 2.2 Requisitos No Funcionales y Seguridad
- **RNF-01 (Seguridad - Zero Client Leakage):** La clave `GEMINI_API_KEY` nunca debe contener el prefijo `VITE_` y bajo ninguna circunstancia debe empaquetarse en el código cliente ni enviarse por la red hacia el navegador.
- **RNF-02 (Validación de Payload y Tamaño):** Validar que las solicitudes no superen el límite de carga de Netlify Functions (6 MB). Dado que las fotos ya se comprimen a ~100-300 KB en el cliente, este margen es amplio y seguro.
- **RNF-03 (Whitelist de Métodos):** El endpoint de la función solo aceptará el método `POST`. Cualquier otro método responderá `405 Method Not Allowed`.
- **RNF-04 (Latencia mínima):** La función actuará como un proxy liviano de streaming/fetch directo sin dependencias pesadas de terceros (usará `fetch` nativo de Node.js 18+).

---

## 3. Arquitectura y Stack Tecnológico

### 3.1 Stack Tecnológico
- **Runtime Serverless:** Netlify Functions (Node.js 18+ o 20+ con `fetch` nativo ES Modules / CommonJS).
- **Frontend:** React 18 + Vite (SPA existente).
- **Configuración de Despliegue:** `netlify.toml` para definir la carpeta de funciones y redirecciones.
- **Servicio de IA:** Google Gemini API (`generativelanguage.googleapis.com/v1beta`).

### 3.2 Diagrama de Flujo de Información

```
[ Navegador del Usuario ]
         │
         │  1. POST /.netlify/functions/gemini
         │     Payload: { modelo, tipo: 'foto'|'texto', payloadGemini }
         ▼
[ Netlify Function (Backend Seguro) ]
         │
         │  2. Lee process.env.GEMINI_API_KEY (Privada)
         │  3. Valida modelo y estructura
         │  4. POST https://generativelanguage.googleapis.com/...:generateContent?key=***
         ▼
[ Google Gemini API ]
         │
         │  5. Retorna JSON generado
         ▼
[ Netlify Function ]
         │
         │  6. Reenvía respuesta JSON al cliente
         ▼
[ Navegador del Usuario (src/services/gemini.js) ]
```

### 3.3 Estructura de Directorios Afectada

```
registro-comidas/
├── netlify/
│   └── functions/
│       └── gemini.js            # [NUEVO] Handler de la Netlify Function
├── netlify.toml                 # [NUEVO] Configuración de Netlify (build, functions, headers)
├── vite.config.js               # [MODIFICADO] Middleware dev para atender /.netlify/functions/gemini en local
├── src/
│   ├── config.js                # [MODIFICADO] Eliminación de VITE_API_GEMINI
│   └── services/
│       └── gemini.js            # [MODIFICADO] Redirección de llamadas a /.netlify/functions/gemini
├── .env.example                 # [MODIFICADO] Reemplazo de VITE_API_GEMINI por GEMINI_API_KEY
└── .env                         # [MODIFICADO] Configuración de GEMINI_API_KEY privada
```

---

## 4. Diseño Detallado de la API

### 4.1 Endpoint: `POST /.netlify/functions/gemini`

#### Headers de Solicitud:
- `Content-Type: application/json`

#### Cuerpo de la Solicitud (Request Body):
```json
{
  "modelo": "gemini-2.5-flash",
  "payload": {
    "systemInstruction": { ... },
    "contents": [ ... ],
    "generationConfig": {
      "responseMimeType": "application/json",
      "temperature": 0.2
    }
  }
}
```

#### Respuestas:
- **200 OK:** Devuelve el cuerpo exacto devuelto por Gemini API (`candidates`, etc.).
- **400 Bad Request:** Payload malformado o modelo no válido.
- **405 Method Not Allowed:** Si se llama con GET u otro verbo.
- **429 Too Many Requests:** Modelo saturado o cuota excedida (propagado con mensaje amigable).
- **500 Internal Server Error:** Error de conexión o API Key faltante en variables de entorno del servidor.

---

## 5. Estrategia de Migración y Desarrollo Local

1. **Configuración en Netlify:**
   - En el panel de Netlify -> *Site Configuration* -> *Environment Variables*, se cargará `GEMINI_API_KEY` (sin el prefijo `VITE_`).
2. **Desarrollo en local con `npm run dev`:**
   - Vite incluirá un plugin en `vite.config.js` que interceptará `/.netlify/functions/gemini` e invocará el mismo código handler con las variables de `process.env` o `.env` local.
   - De esta manera, el desarrollador no necesita instalar nada adicional para seguir probando en local de forma idéntica a producción.

---

## 6. Plan de Fases de Ejecución

1. **Fase 1 (PM):** Aprobación de esta especificación por parte del usuario.
2. **Fase 2 (Ingeniero Full-Stack):**
   - Crear `netlify.toml` y `netlify/functions/gemini.js`.
   - Modificar `vite.config.js` para proveer el endpoint de funciones en modo dev local.
   - Actualizar `src/services/gemini.js` y `src/config.js` para usar la nueva ruta relativa `/.netlify/functions/gemini`.
   - Actualizar `.env.example` y `.env`.
3. **Fase 3 (QA):**
   - Validar que no quede ninguna referencia a la API Key en el código fuente cliente.
   - Probar análisis de foto y análisis de texto.
   - Verificar manejo de errores (cuota, red, modelo inválido).
4. **Fase 4 (DevOps):**
   - Verificar build de producción (`npm run build`).
   - Validar que `dist/` no contenga la API Key.
   - Dejar el servidor local listo para prueba y documentar las variables requeridas en Netlify.

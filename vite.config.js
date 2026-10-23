import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const MODELOS_PERMITIDOS = new Set([
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-2.5-pro',
  'gemini-1.5-pro'
])

function netlifyFunctionsDevPlugin() {
  let env = {}

  return {
    name: 'netlify-functions-dev-proxy',
    configResolved(config) {
      env = loadEnv(config.mode, process.cwd(), '')
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || ''
        if (url === '/.netlify/functions/gemini' || url.startsWith('/.netlify/functions/gemini?')) {
          if (req.method === 'OPTIONS') {
            res.statusCode = 204
            res.setHeader('Access-Control-Allow-Origin', '*')
            res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
            res.end()
            return
          }

          if (req.method !== 'POST') {
            res.statusCode = 405
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: { message: 'Método no permitido. Solo se acepta POST.' } }))
            return
          }

          const apiKey = (env.GEMINI_API_KEY || env.VITE_API_GEMINI || process.env.GEMINI_API_KEY || '').trim()
          if (!apiKey) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              error: { message: 'No se encontró GEMINI_API_KEY en tu archivo .env local.' }
            }))
            return
          }

          let bodyText = ''
          req.on('data', chunk => {
            bodyText += chunk
          })

          req.on('end', async () => {
            try {
              const body = JSON.parse(bodyText || '{}')
              const { modelo, payload } = body || {}

              if (!modelo || typeof modelo !== 'string') {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: { message: "El parámetro 'modelo' es requerido." } }))
                return
              }

              if (!payload || typeof payload !== 'object') {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: { message: "El parámetro 'payload' es requerido y debe ser un objeto." } }))
                return
              }

              const modeloNormalizado = modelo.trim()
              if (!MODELOS_PERMITIDOS.has(modeloNormalizado)) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: { message: `El modelo '${modeloNormalizado}' no está permitido.` } }))
                return
              }

              const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modeloNormalizado)}:generateContent?key=${apiKey}`
              const geminiRes = await fetch(geminiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              })

              const rawResponse = await geminiRes.text()
              res.statusCode = geminiRes.status
              res.setHeader('Content-Type', 'application/json')
              res.end(rawResponse)
            } catch (err) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: { message: err.message || 'Error en el servidor proxy local.' } }))
            }
          })
          return
        }
        next()
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), netlifyFunctionsDevPlugin()]
})

import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/**
 * Content-Security-Policy de la app empaquetada (Electron recomienda siempre una CSP).
 * Se inserta como <meta> en index.html SOLO al compilar (vite build): el servidor de
 * desarrollo necesita scripts en línea y websockets para la recarga en caliente.
 *
 * connect-src se arma con la misma VITE_API_BASE_URL que queda dentro del bundle,
 * así la interfaz sólo puede hablar con NUESTRA API (si se inyectara código, no podría
 * enviar datos a otro servidor). Las descargas de drivers las hace el proceso principal
 * de Electron, que no está sujeto a esta política.
 */
function contentSecurityPolicy(apiBaseUrl: string): Plugin {
  const apiOrigin = new URL(apiBaseUrl).origin

  const policy = [
    "default-src 'none'", // todo lo no listado abajo queda prohibido
    "script-src 'self'", // sólo el bundle propio (app://driwin), nada en línea ni eval
    "style-src 'self'", // la hoja de estilos propia (los style={{}} de React usan CSSOM y no se bloquean)
    "img-src 'self' data:", // íconos propios y SVG embebidos
    "font-src 'self'",
    `connect-src ${apiOrigin}`, // fetch() únicamente hacia la API de DriWin
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ')

  return {
    name: 'driwin-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'pre',
      handler: () => [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: policy },
          injectTo: 'head-prepend',
        },
      ],
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  // Mismo valor por defecto que src/api/client.ts.
  const apiBaseUrl = env.VITE_API_BASE_URL ?? 'http://localhost:3000'

  return {
    plugins: [react(), contentSecurityPolicy(apiBaseUrl)],
  }
})

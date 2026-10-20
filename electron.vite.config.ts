import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'
import type { Plugin } from 'vite'

const alias = { '@shared': resolve('src/shared') }

const PROD_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:"

// Dev needs inline scripts for HMR, so the strict CSP is injected into production builds only.
const prodCsp = (): Plugin => ({
  name: 'deckpulse-prod-csp',
  apply: 'build',
  transformIndexHtml: () => [
    {
      tag: 'meta',
      attrs: { 'http-equiv': 'Content-Security-Policy', content: PROD_CSP },
      injectTo: 'head-prepend'
    }
  ]
})

export default defineConfig({
  main: { resolve: { alias } },
  preload: { resolve: { alias } },
  renderer: { resolve: { alias }, plugins: [react(), tailwindcss(), prodCsp()] }
})

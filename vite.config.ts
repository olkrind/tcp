import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import site from './site.config.json' with { type: 'json' }

// Путь сайта берётся из siteUrl: https://olkrind.github.io/phofoleo → /phofoleo/
const base = new URL(site.siteUrl).pathname.replace(/\/?$/, '/')

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
})

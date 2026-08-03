import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Multi-page build: the photography site (index.html) plus the two Rodeo pages.
// Each entry becomes its own statically-served folder on GitHub Pages.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  base: '/',
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        rodeoHq: 'rodeo-hq/index.html',
        rodeoPublic: 'the-rodeo/index.html',
      },
    },
  },
})
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Le build (dist/) ne doit jamais recharger la page de dev
  server: { watch: { ignored: ['**/dist/**', '**/.claude/**'] } },
})

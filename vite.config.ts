import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,   // expone en la red local (Wi-Fi) para acceder desde el teléfono
    port: 5173,
  },
})

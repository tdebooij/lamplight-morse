import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

// Phones only allow camera/flashlight on HTTPS, so serve a self-signed cert on the local network
export default defineConfig({
  plugins: [basicSsl()],
  server: { host: true, port: 5173 },
})

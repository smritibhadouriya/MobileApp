import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Allow phones on the same Wi-Fi to open the dev site
    host: true,
    // Forward realtime traffic to the Socket.io server during development
    proxy: {
      '/socket.io': { target: 'http://localhost:3001', ws: true },
      '/api': 'http://localhost:3001',
    },
  },
  optimizeDeps: {
    // Pre-bundle deps that are only imported lazily (dialogs, Android plugins) so the dev
    // server doesn't discover them mid-session and fail with "504 Outdated Optimize Dep"
    include: [
      'katex',
      'socket.io-client',
      'lucide-react',
      '@capacitor/core',
      '@capacitor/app',
      '@capacitor/local-notifications',
      '@capacitor/status-bar',
      '@capacitor-community/keep-awake',
    ],
  },
})

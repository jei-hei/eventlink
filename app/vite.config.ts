import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    vue(),
    tailwindcss(),
    ...(mode === 'development' ? [vueDevTools()] : []),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('xlsx')) return 'xlsx'
          if (id.includes('lucide-vue-next')) return 'icons'
          if (
            id.includes('/vue/') ||
            id.includes('vue-router') ||
            id.includes('pinia') ||
            id.includes('@vue/')
          ) {
            return 'vue-vendor'
          }
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
}))

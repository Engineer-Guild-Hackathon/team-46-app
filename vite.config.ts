import { defineConfig } from 'vite'
import path from 'path'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// eslint-env node

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      $lib: path.resolve(new URL('.', import.meta.url).pathname, './src/lib'),
    },
  },
  server: {
    proxy: {
      '/api/books': {
        target: 'https://us-central1-flexread-egh.cloudfunctions.net',
        changeOrigin: true,
        rewrite: (pathStr) => pathStr.replace(/^\/api\/books/, '/getBooks'),
      },
      '/api/text': {
        // Placeholder backend; change target when real endpoint ready
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})

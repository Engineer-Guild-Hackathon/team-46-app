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
})

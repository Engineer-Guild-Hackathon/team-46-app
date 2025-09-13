import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    resolve: {
      conditions: ['browser', 'development'],
    },
    test: {
      environment: 'jsdom',
      include: ['tests/**/*.{test,spec}.ts'],
      setupFiles: ['tests/setup.ts'],
    },
  })
)

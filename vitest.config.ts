import { defineConfig } from 'vitest/config'
import { APP_NAME } from './app-name'

export default defineConfig({
  define: {
    // The same build-time constant vite.config.ts injects. Without it the app
    // hits a ReferenceError on render and every DOM query fails on an empty body.
    __HADOKU_APP_NAME__: JSON.stringify(APP_NAME)
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.{ts,tsx}'],
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/entry.tsx', 'src/App.tsx']
    }
  }
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/craft/api': {
        target: 'http://localhost:8787',
        changeOrigin: true
      }
    }
  },
  build: {
    // The favicon in public/ is for the `vite dev` harness only. This bundle is
    // a library mounted into hadoku.me, which serves its own favicon from the
    // site root — so copying public/ into dist/ would ship a stray asset in the
    // published package that nothing would ever read.
    copyPublicDir: false,
    lib: {
      entry: 'src/entry.tsx',
      formats: ['es'],
      fileName: () => 'index.js'
    },
    rollupOptions: {
      // Externalize peer dependencies — the parent provides them via its
      // import map (see hadoku_site src/layouts/Base.astro).
      //
      // @wolffm/task-ui-components MUST be external. HadokuThemeRoot comes
      // from the mapped @wolffm/themes and provides theme context through the
      // PARENT's ui-components module; an inlined copy here holds a second,
      // distinct React context, so AppHeader's useHadokuTheme reads null and
      // throws "No <HadokuThemeRoot> above this component" even though the root
      // is wrapped. That is the 2026-08-05 outage, which hit hadoku-aggregator
      // first and this app for the same reason.
      //
      // logger/client and prefs-client are parent-shared singletons on the same
      // logic: a private inlined copy silently forks their state.
      external: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        '@wolffm/themes',
        '@wolffm/task-ui-components',
        '@wolffm/logger/client',
        '@wolffm/prefs-client',
        '@wolffm/prefs-client/react'
      ],
      output: {
        assetFileNames: 'style.css'
      }
    },
    target: 'es2022',
    cssCodeSplit: false
  }
})

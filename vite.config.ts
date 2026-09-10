import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { APP_NAME } from './app-name'

export default defineConfig({
  define: {
    // The standalone name. Mounted by the host, `appName` in the registry props
    // carries the live value and this is never read.
    __HADOKU_APP_NAME__: JSON.stringify(APP_NAME)
  },
  plugins: [
    {
      // index.html is static and cannot import the catalogue; this keeps the
      // standalone TAB and the standalone HEADER the one name.
      name: 'hadoku-app-name',
      transformIndexHtml: (html: string) => html.split('__HADOKU_APP_NAME__').join(APP_NAME)
    },
    react()
  ],
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

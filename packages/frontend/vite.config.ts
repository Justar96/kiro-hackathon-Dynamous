import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { tanstackRouter } from '@tanstack/router-plugin/vite';

export default defineConfig({
  plugins: [
    // TanStack Router plugin must come before React plugin
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
      quoteStyle: 'single',
    }),
    react(),
  ],
  build: {
    target: 'es2020',
    minify: 'esbuild',
    cssMinify: 'esbuild',
    cssCodeSplit: true,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        // Optimized chunk splitting for better caching
        manualChunks: {
          // Core React - rarely changes, cache long-term
          'vendor-react': ['react', 'react-dom'],
          // TanStack ecosystem - grouped for shared dependencies
          'vendor-tanstack-router': ['@tanstack/react-router', '@tanstack/router-devtools'],
          'vendor-tanstack-query': ['@tanstack/react-query', '@tanstack/react-query-devtools'],
          'vendor-tanstack-virtual': ['@tanstack/react-virtual'],
          // Auth/DB - Neon specific
          'vendor-neon': ['@neondatabase/neon-js'],
          // Animation library
          'vendor-motion': ['motion'],
        },
        // Optimized file naming for cache busting
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const extname = assetInfo.names?.[0]?.split('.').pop() || '';
          if (/png|jpe?g|svg|gif|webp|avif|ico/i.test(extname)) {
            return 'assets/images/[name]-[hash][extname]';
          }
          if (/woff2?|eot|ttf|otf/i.test(extname)) {
            return 'assets/fonts/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
      // Tree shaking optimization
      treeshake: {
        moduleSideEffects: 'no-external',
        propertyReadSideEffects: false,
      },
    },
  },
  // Dependency pre-bundling optimization
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@tanstack/react-query',
      '@tanstack/react-router',
    ],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});

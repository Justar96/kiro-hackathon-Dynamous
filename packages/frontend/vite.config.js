import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
export default defineConfig({
    plugins: [
        TanStackRouterVite({
            routesDirectory: './src/routes',
            generatedRouteTree: './src/routeTree.gen.ts',
            quoteStyle: 'single',
        }),
        react(),
    ],
    build: {
        target: 'baseline-widely-available',
        minify: 'esbuild',
        cssMinify: 'esbuild',
        cssCodeSplit: true,
        reportCompressedSize: false,
        chunkSizeWarningLimit: 700,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules')) {
                        if (id.includes('@tanstack')) return 'vendor-tanstack';
                        if (id.includes('@neondatabase')) return 'vendor-neon';
                        if (id.includes('react')) return 'vendor-react';
                        if (id.includes('zod')) return 'vendor-zod';
                        if (id.includes('lucide')) return 'vendor-icons';
                        return 'vendor';
                    }
                    return undefined;
                },
            },
        },
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

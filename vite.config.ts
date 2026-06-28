import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    port: 3000,
    host: true,
  },
  preview: {
    port: 3000,
  },
  build: {
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor: React core
          'vendor-react': ['react', 'react-dom'],
          // Vendor: Lucide icons (large)
          'vendor-icons': ['lucide-react'],
          // Admin panel — only loaded when admin visits
          'chunk-admin': ['./src/components/AdminPanel'],
          // Checkout — only loaded at checkout
          'chunk-checkout': ['./src/components/CheckoutPage'],
          // Product page
          'chunk-product': ['./src/components/ProductPage'],
        },
      },
    },
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Source maps off for production (faster build + smaller output)
    sourcemap: false,
    // Minify with esbuild (default, fast)
    minify: 'esbuild',
    target: 'es2015',
  },
});

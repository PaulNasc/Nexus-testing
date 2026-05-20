import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 5173,
    strictPort: false,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('@radix-ui') || id.includes('cmdk')) return 'vendor-radix';
            if (id.includes('@google/generative-ai') || id.includes('openai') || id.includes('@anthropic-ai') || id.includes('groq-sdk')) return 'vendor-ai';
            if (id.includes('react-dom') || id.includes('react-router') || id.includes('react-query') || id.includes('@tanstack')) return 'vendor-react';
            if (id.includes('lucide-react') || id.includes('recharts')) return 'vendor-ui';
            return 'vendor';
          }
        },
      },
    },
  },
}));

/// <reference types="vitest" />
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  test: { // Add Vitest configuration
    globals: true, // Enable global API (vi, describe, it, etc.)
    environment: 'node', // Specify the test environment
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index'
    },
    rollupOptions: {
      external: ['@modelcontextprotocol/sdk', 'bun', 'process']
    },
    outDir: 'dist',
    sourcemap: true
  },
  plugins: [dts()]
});

import { defineConfig } from 'vite';
import { Buffer } from 'buffer';

globalThis.Buffer = Buffer;

export default defineConfig({
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      buffer: 'buffer',
    },
  },
});

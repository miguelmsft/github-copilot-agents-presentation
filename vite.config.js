import { defineConfig } from 'vite';

export default defineConfig({
  base: '/github-copilot-agents-presentation/',
  server: {
    open: false,
    port: 5174
  },
  build: {
    outDir: 'dist'
  }
});

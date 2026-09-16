import { defineConfig } from 'vite';

/**
 * La ruta base es la del repositorio en GitHub Pages. El servidor de
 * desarrollo sirve bajo la MISMA ruta a propósito: así lo que se ve en local
 * es exactamente lo que se ve publicado, incluidos los enlaces y los recursos.
 */
export default defineConfig({
  base: '/nexus-cargo/',
  server: { port: 4400, host: true },
  preview: { port: 4400, host: true },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 2048,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(ruta) {
          if (ruta.includes('node_modules/three')) return 'three';
          if (ruta.includes('node_modules/gsap')) return 'gsap';
          return null;
        },
      },
    },
  },
});

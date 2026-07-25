import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: ".",
  publicDir: "public",
  base: "/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    cssCodeSplit: false,
    modulePreload: { polyfill: false },
    target: "es2018",
    assetsInlineLimit: 0,
    rollupOptions: {
      input: resolve(__dirname, "index.html"),
      output: {
        inlineDynamicImports: true,
        entryFileNames: "assets/client-[hash].js",
        chunkFileNames: "assets/client-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]"
      }
    }
  },
  server: {
    port: 5175,
    strictPort: true,
    open: false
  },
  preview: {
    port: 4175
  }
});

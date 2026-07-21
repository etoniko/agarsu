import { defineConfig } from "vite";
import { resolve } from "path";
var stdin_default = defineConfig({
  root: ".",
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: resolve(__dirname, "index.html")
    }
  },
  server: {
    port: 5174,
    strictPort: true,
    open: false
  },
  preview: {
    port: 4174
  }
});
export {
  stdin_default as default
};
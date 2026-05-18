import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@oikos/shared": fileURLToPath(new URL("../../packages/shared/src/index.ts", import.meta.url)),
      "@oikos/content": fileURLToPath(new URL("../../packages/content/src/index.ts", import.meta.url)),
      "@oikos/rules": fileURLToPath(new URL("../../packages/rules/src/index.ts", import.meta.url))
    }
  },
  server: {
    port: 5187,
    strictPort: true
  },
  build: {
    chunkSizeWarningLimit: 1300,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/phaser")) {
            return "phaser";
          }

          if (id.includes("node_modules")) {
            return "vendor";
          }
        }
      }
    }
  }
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import pkg from "./package.json" with { type: "json" };
import { contentSecurityPolicyPlugin } from "./vite.csp.ts";

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __NYX_WEB__: true,
  },
  base: "./",
  plugins: [react(), tailwindcss(), contentSecurityPolicyPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    port: 5174,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 2048,
  },
});

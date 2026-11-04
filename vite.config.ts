import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: false,
    allowedHosts: true,
    proxy: {
      // One origin in the browser: the dev server proxies API calls to Hono.
      // This keeps auth cookies first-party and mirrors production exactly.
      "/api": {
        target: process.env.API_ORIGIN ?? "http://127.0.0.1:8787",
        changeOrigin: false,
        ws: false,
      },
    },
  },
});

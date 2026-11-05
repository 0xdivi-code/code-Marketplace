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
    watch: {
      // The embedded database and private upload storage live inside the repo.
      // Without this, every write — including the session row inserted when you
      // sign in — is a "file change" and Vite hard-reloads the page mid-request.
      ignored: [
        "**/.data/**",
        "**/.git/**",
        "**/scripts/**",
        "**/server/**",
        "**/dist/**",
      ],
    },
    proxy: {
      // One origin in the browser: the dev server proxies API calls to Hono.
      // This keeps auth cookies first-party and mirrors production exactly.
      "/api": {
        target: process.env.API_ORIGIN ?? "http://127.0.0.1:8787",
        changeOrigin: false,
        ws: false,
      },
      // Search-engine files must live at the domain root, not under /api.
      "/robots.txt": {
        target: process.env.API_ORIGIN ?? "http://127.0.0.1:8787",
        rewrite: () => "/api/robots.txt",
        changeOrigin: false,
      },
      "/sitemap.xml": {
        target: process.env.API_ORIGIN ?? "http://127.0.0.1:8787",
        rewrite: () => "/api/sitemap.xml",
        changeOrigin: false,
      },
    },
  },
});

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Local Worker (wrangler dev) runs on 8787. In production the Worker serves this app, so /api is same-origin.
    proxy: { "/api": { target: "http://localhost:8787", changeOrigin: true } },
  },
});

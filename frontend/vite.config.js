import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Forwards frontend calls to /api/* straight to the Express backend
      "/api": {
        target: "http://localhost:5002",
        changeOrigin: true
      }
    }
  }
});

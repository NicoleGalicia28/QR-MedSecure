import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Listen on all interfaces so LAN devices (phone) and port forwarding can reach it.
    host: true,
    port: 5173,
    strictPort: true,
    open: false,
    proxy: {
      // Optional dev proxy to the Django IoT API (qr_medsecure_api-main)
      "/iot-api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/iot-api/, "/api/v1"),
      },
    },
  },
});

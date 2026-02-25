import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    port: 8080,
    allowedHosts: true,
    proxy: {
      // Redireciona /api e /socket.io para o backend local
      // Assim tudo passa pelo mesmo túnel ngrok (HTTPS) sem mixed content
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "/socket.io": {
        target: "http://localhost:3001",
        changeOrigin: true,
        ws: true, // habilita proxy de WebSocket
      },
    },
  },
});
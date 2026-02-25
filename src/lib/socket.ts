import { io } from "socket.io-client";

// Conecta no mesmo host/porta do frontend (passa pelo proxy do Vite)
// Funciona tanto no PC (localhost:8080) quanto no celular via ngrok (HTTPS)
export const socket = io("/", {
  path: "/socket.io",
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 10000,
});

socket.on("connect",       () => console.log("✅ Socket conectado:", socket.id));
socket.on("disconnect",    (r) => console.log("❌ Socket desconectado:", r));
socket.on("connect_error", (e) => console.log("⚠️ Erro de conexão:", e.message));
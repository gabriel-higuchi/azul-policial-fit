import { io } from "socket.io-client";

// Pega o IP/host automaticamente do endereço que o app está sendo acessado
// Assim funciona em qualquer IP local sem precisar trocar manualmente
const SERVER_URL = `http://${window.location.hostname}:3001`;

export const socket = io(SERVER_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 10000,
});

// Debug de conexão (remova em produção)
socket.on("connect",         () => console.log("✅ Socket conectado:", socket.id));
socket.on("disconnect",      (r) => console.log("❌ Socket desconectado:", r));
socket.on("connect_error",   (e) => console.log("⚠️ Erro de conexão:", e.message));
socket.on("reconnect",       (n) => console.log("🔄 Reconectado após", n, "tentativas"));
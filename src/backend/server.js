const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let messages = [
  { user: "Carlos S.", msg: "Alguém estudando Direito Penal hoje?", time: "14:32" }
];

let ranking = [
  { name: "Carlos Silva", score: 980, avatar: "CS" },
  // ...
];

// REST - buscar ranking
app.get("/api/ranking", (req, res) => res.json(ranking));

// WebSocket - chat
io.on("connection", (socket) => {
  // Envia histórico ao conectar
  socket.emit("history", messages);

  socket.on("message", (data) => {
    const msg = { ...data, time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) };
    messages.push(msg);
    io.emit("message", msg); // broadcast pra todos
  });
});

server.listen(3001, () => console.log("Backend rodando em http://localhost:3001"));
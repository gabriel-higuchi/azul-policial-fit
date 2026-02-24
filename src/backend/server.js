const express = require("express");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// ─── Persistência em arquivo ──────────────────────────────────────────────────

const MESSAGES_FILE = path.join(__dirname, "data_messages.json");
const RANKING_FILE  = path.join(__dirname, "data_ranking.json");

function loadJSON(filePath, fallback) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
  } catch (e) {
    console.error("Erro ao carregar", filePath, e.message);
  }
  return fallback;
}

function saveJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    console.error("Erro ao salvar", filePath, e.message);
  }
}

// ─── Estado carregado do disco ────────────────────────────────────────────────

let messages = loadJSON(MESSAGES_FILE, [
  { user: "Sistema", msg: "Bem-vindos ao chat da comunidade! 👮", time: "00:00" },
]);

const rankingMapRaw = loadJSON(RANKING_FILE, {});
const rankingMap   = new Map(Object.entries(rankingMapRaw));

const MAX_MESSAGES = 200;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name = "") {
  return name
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function getRankingArray() {
  return Array.from(rankingMap.values())
    .sort((a, b) => b.totalScore - a.totalScore)
    .map(({ name, totalScore, attempts, avatar }) => ({
      name,
      score: totalScore,
      attempts,
      avatar,
    }));
}

function persistRanking() {
  saveJSON(RANKING_FILE, Object.fromEntries(rankingMap));
}

function persistMessages() {
  saveJSON(MESSAGES_FILE, messages);
}

// ─── REST ─────────────────────────────────────────────────────────────────────

app.get("/api/ranking", (req, res) => res.json(getRankingArray()));

app.post("/api/ranking/submit", (req, res) => {
  const { userId, name, score, total } = req.body;
  if (!userId || !name || score == null || !total)
    return res.status(400).json({ error: "Campos obrigatórios: userId, name, score, total" });
  submitScore({ userId, name, score, total });
  res.json({ ok: true, ranking: getRankingArray() });
});

// ─── Lógica de pontuação ──────────────────────────────────────────────────────

function submitScore({ userId, name, score, total }) {
  const points   = Math.round((score / total) * 1000);
  const existing = rankingMap.get(userId);

  if (existing) {
    existing.totalScore += points;
    existing.attempts   += 1;
  } else {
    rankingMap.set(userId, {
      name,
      totalScore: points,
      attempts:   1,
      avatar:     getInitials(name),
    });
  }

  persistRanking();
  io.emit("ranking", getRankingArray());
}

// ─── WebSocket ────────────────────────────────────────────────────────────────

io.on("connection", (socket) => {
  socket.emit("history", messages);
  socket.emit("ranking", getRankingArray());

  socket.on("message", (data) => {
    const msg = {
      user: data.user || "Anônimo",
      msg:  data.msg  || "",
      time: new Date().toLocaleTimeString("pt-BR", {
        hour:   "2-digit",
        minute: "2-digit",
      }),
    };

    messages.push(msg);
    if (messages.length > MAX_MESSAGES) messages = messages.slice(-MAX_MESSAGES);

    persistMessages();
    io.emit("message", msg);
  });

  socket.on("submitScore", ({ userId, name, score, total }) => {
    if (!userId || !name || score == null || !total) return;
    submitScore({ userId, name, score, total });
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

server.listen(3001, "0.0.0.0", () =>
  console.log("✅ Backend rodando em http://0.0.0.0:3001")
);
require("dotenv").config();
const { generateDailyQuestions } = require("./generate-questions");
const express = require("express");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.get("/", (req, res) => {
  res.send("✅ Server online");
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

/* ======================================================
   FILES
====================================================== */

const MESSAGES_FILE = path.join(__dirname, "data_messages.json");
const RANKING_FILE  = path.join(__dirname, "data_ranking.json");
const TAF_FILE      = path.join(__dirname, "data_taf.json");

/* ======================================================
   JSON HELPERS
====================================================== */

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
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Erro ao salvar", filePath, e.message);
  }
}

/* ======================================================
   STATE
====================================================== */

let messages = loadJSON(MESSAGES_FILE, [
  { user: "Sistema", msg: "Bem-vindos ao chat 👮", time: "00:00" },
]);

const rankingMap = new Map(
  Object.entries(loadJSON(RANKING_FILE, {}))
);

const tafRanking = loadJSON(TAF_FILE, {});

const MAX_MESSAGES = 200;

/* ======================================================
   HELPERS
====================================================== */

function getInitials(name = "") {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
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

function getTafRanking() {
  return Object.values(tafRanking)
    .sort((a, b) => b.score - a.score);
}

function persistRanking() {
  saveJSON(RANKING_FILE, Object.fromEntries(rankingMap));
}

function persistMessages() {
  saveJSON(MESSAGES_FILE, messages);
}

function persistTaf() {
  saveJSON(TAF_FILE, tafRanking);
}

/* ======================================================
   WEEKLY RESET — toda segunda-feira à meia-noite
====================================================== */

function doReset() {
  // Limpa ranking quiz
  rankingMap.clear();
  persistRanking();
  io.emit("ranking", []);

  // Limpa ranking TAF
  Object.keys(tafRanking).forEach(key => delete tafRanking[key]);
  persistTaf();
  io.emit("taf_ranking", []);

  // Limpa mensagens do chat
  messages = [{ user: "Sistema", msg: "Nova semana, novo treino! 💪", time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) }];
  persistMessages();
  io.emit("history", messages);

  console.log("✅ Rankings e chat zerados com sucesso");
}

function checkWeeklyReset() {
  const now = new Date();
  if (now.getDay() === 1 && now.getHours() === 0 && now.getMinutes() === 0) {
    console.log("🔄 Reset semanal automático — segunda-feira meia-noite");
    doReset();
  }
}

setInterval(checkWeeklyReset, 60 * 1000);


/*======================================================
   GERAÇÃO DIÁRIA DE QUESTÕES — todo dia à meia-noite
====================================================== */
let lastQuestionGenDate = null;

function checkDailyQuestions() {
  const now = new Date();
  const today = now.toDateString();

  // Roda uma vez por dia à meia-noite
  if (now.getHours() === 0 && now.getMinutes() === 0 && lastQuestionGenDate !== today) {
    lastQuestionGenDate = today;
    console.log("🤖 Iniciando geração diária de questões...");
    generateDailyQuestions().catch((err) =>
      console.error("❌ Erro na geração diária:", err.message)
    );
  }
}

setInterval(checkDailyQuestions, 60 * 1000);

// Gera questões ao iniciar o servidor se nunca gerou hoje
const todayStr = new Date().toDateString();
if (lastQuestionGenDate !== todayStr) {
  lastQuestionGenDate = todayStr;
  console.log("🤖 Gerando questões iniciais ao iniciar servidor...");
  generateDailyQuestions().catch((err) =>
    console.error("❌ Erro na geração inicial:", err.message)
  );
}


/* ======================================================
   QUIZ SCORE
====================================================== */

function submitScore({ userId, name, score, total }) {
  const points = Math.round((score / total) * 1000);
  const existing = rankingMap.get(userId);

  if (existing) {
    existing.totalScore += points;
    existing.attempts++;
  } else {
    rankingMap.set(userId, {
      name,
      totalScore: points,
      attempts: 1,
      avatar: getInitials(name),
    });
  }

  persistRanking();
  io.emit("ranking", getRankingArray());
}

/* ======================================================
   SOCKET
====================================================== */

io.on("connection", (socket) => {
  console.log("👤 usuário conectado");

  socket.emit("history", messages);
  socket.emit("ranking", getRankingArray());
  socket.emit("taf_ranking", getTafRanking());

  /* ---------------- CHAT ---------------- */

  socket.on("message", (data) => {
    const msg = {
      user: data.user || "Anônimo",
      msg: data.msg || "",
      time: new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    messages.push(msg);

    if (messages.length > MAX_MESSAGES)
      messages = messages.slice(-MAX_MESSAGES);

    persistMessages();
    io.emit("message", msg);
  });

  /* ---------------- QUIZ ---------------- */

  socket.on("submitScore", submitScore);

  /* ---------------- TAF RESULT ---------------- */

  socket.on("taf_result", (entry) => {
    console.log("💪 taf_result recebido:", entry);
    const key = `${entry.name}__${entry.type}`;
    if (!tafRanking[key] || entry.score > tafRanking[key].score) {
      tafRanking[key] = entry;
      persistTaf();
    }
    console.log("📊 taf_ranking atualizado:", getTafRanking());
    io.emit("taf_ranking", getTafRanking());
  });

  socket.on("get_taf_ranking", () => {
    console.log("📊 get_taf_ranking solicitado");
    socket.emit("taf_ranking", getTafRanking());
  });

  /* ---------------- CLEAR TAF ---------------- */

  socket.on("clear_taf_ranking", () => {
    Object.keys(tafRanking).forEach(key => delete tafRanking[key]);
    persistTaf();
    io.emit("taf_ranking", []);
    console.log("🗑️ TAF ranking limpo");
  });

  /* ---------------- FORCE RESET (teste) ---------------- */

  socket.on("force_reset", () => {
    console.log("🔄 Reset forçado");
    doReset();
  });
});

/* ======================================================
   START
====================================================== */

const PORT = process.env.PORT || 8080;
server.listen(PORT, "0.0.0.0", () =>
  console.log(`✅ Backend rodando na porta ${PORT}`)
);
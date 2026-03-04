import { io, Socket } from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_SERVER_URL;

/* ======================================================
   TYPES
====================================================== */

export type Message = {
  user: string;
  msg: string;
  time: string;
  mentions?: string[];
};

export type RankingUser = {
  name: string;
  score: number;
  avatar: string;
  attempts?: number;
};

export type TafRankingEntry = {
  name: string;
  score: number;
  type: string;
  date: string;
  avatar?: string;
};

/* ======================================================
   SOCKET
====================================================== */

export const socket: Socket = SERVER_URL
  ? io(SERVER_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    })
  : io({
      path: "/socket.io",
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

/* ======================================================
   USER HELPERS
====================================================== */

export function setChatUsername(username: string) {
  localStorage.setItem("chat_username", username);
  socket.emit("join", username);
}

export function getChatUsername() {
  return localStorage.getItem("chat_username") || "Anônimo";
}

/* ======================================================
   GLOBAL CACHE
====================================================== */

export const globalCache = {
  messages: [] as Message[],
  ranking: [] as RankingUser[],
  tafRanking: [] as TafRankingEntry[],
  onlineUsers: [] as string[],

  unreadCount: 0,
  mentionCount: 0,

  listeners: new Set<() => void>(),
};

function notify() {
  globalCache.listeners.forEach((fn) => fn());
}

/* ======================================================
   CONNECTION
====================================================== */

socket.on("connect", () => {
  console.log("✅ Socket conectado:", socket.id);

  socket.emit("join", getChatUsername());
});

socket.on("disconnect", (reason) => {
  console.log("❌ Socket desconectado:", reason);
});

socket.on("connect_error", (err) => {
  console.log("⚠️ Erro conexão:", err.message);
});

/* ======================================================
   ONLINE USERS
====================================================== */

socket.on("online_users", (users: string[]) => {
  globalCache.onlineUsers = users;
  notify();
});

/* ======================================================
   HISTORY
====================================================== */

socket.on("history", (msgs: Message[]) => {
  globalCache.messages = msgs;
  globalCache.unreadCount = 0;
  globalCache.mentionCount = 0;
  notify();
});

/* ======================================================
   NEW MESSAGE
====================================================== */

socket.on("message", (msg: Message) => {
  globalCache.messages = [...globalCache.messages, msg];

  const myUser = getChatUsername();

  globalCache.unreadCount++;

  if (msg.mentions?.includes(myUser)) {
    globalCache.mentionCount++;
    console.log("🔔 Você foi mencionado");
  }

  notify();
});

/* ======================================================
   NORMAL RANKING
====================================================== */

socket.on("ranking", (updated: RankingUser[]) => {
  globalCache.ranking = updated;
  notify();
});

/* ======================================================
   ✅ TAF RANKING (RECEBE DO SERVIDOR)
====================================================== */

socket.on("taf_ranking", (ranking: TafRankingEntry[]) => {
  globalCache.tafRanking = ranking;
  notify();
});

/* ======================================================
   HELPERS
====================================================== */

export function sendTafResult(data: TafRankingEntry) {
  socket.emit("taf_result", data);
}

export function requestTafRanking() {
  socket.emit("get_taf_ranking");
}
import { Trophy, MessageCircle, Send, Crown, Medal, Award, Wifi, WifiOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { socket } from "@/lib/socket";
import { useAuth } from "@/contexts/AuthContext";

type Message     = { user: string; msg: string; time: string };
type RankingUser = { name: string; score: number; avatar: string; attempts?: number };

// Cache fora do componente — sobrevive à troca de página
let cachedMessages: Message[]    = [];
let cachedRanking:  RankingUser[] = [];

const CommunityPage = () => {
  const { session } = useAuth();
  const username =
    session?.user?.user_metadata?.display_name ||
    session?.user?.email ||
    "Anônimo";

  const [tab, setTab]                     = useState<"ranking" | "chat">("ranking");
  const [rankingData, setRankingData]     = useState<RankingUser[]>(cachedRanking);
  const [chatMessages, setChatMessages]   = useState<Message[]>(cachedMessages);
  const [message, setMessage]             = useState("");
  const [connected, setConnected]         = useState(socket.connected);
  const [loadingRanking, setLoadingRanking] = useState(cachedRanking.length === 0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // ── Status de conexão ──────────────────────────────────────────────────
    const onConnect = () => {
      setConnected(true);
    };

    const onDisconnect = () => {
      setConnected(false);
    };

    // ── Dados ──────────────────────────────────────────────────────────────
    const onHistory = (msgs: Message[]) => {
      cachedMessages = msgs;
      setChatMessages([...msgs]);
    };

    const onMessage = (msg: Message) => {
      cachedMessages = [...cachedMessages, msg];
      setChatMessages([...cachedMessages]);
    };

    const onRanking = (updated: RankingUser[]) => {
      cachedRanking = updated;
      setRankingData([...updated]);
      setLoadingRanking(false);
    };

    socket.on("connect",    onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("history",    onHistory);
    socket.on("message",    onMessage);
    socket.on("ranking",    onRanking);

    // Se já conectado, pede dados imediatamente
    // Se não, o servidor enviará automaticamente ao conectar
    if (socket.connected && cachedRanking.length === 0) {
      // Busca ranking via REST como fallback garantido
      fetch("/api/ranking")
        .then((r) => r.json())
        .then((data) => {
          cachedRanking = data;
          setRankingData([...data]);
          setLoadingRanking(false);
        })
        .catch(() => setLoadingRanking(false));
    } else if (cachedRanking.length > 0) {
      setLoadingRanking(false);
    }

    return () => {
      socket.off("connect",    onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("history",    onHistory);
      socket.off("message",    onMessage);
      socket.off("ranking",    onRanking);
    };
  }, []);

  // Scroll automático no chat
  useEffect(() => {
    if (tab === "chat") {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }
  }, [chatMessages, tab]);

  const sendMessage = () => {
    if (!message.trim() || !connected) return;
    socket.emit("message", { user: username, msg: message.trim() });
    setMessage("");
  };

  const getRankIcon = (i: number) => {
    if (i === 0) return <Crown size={18} className="text-yellow-400" />;
    if (i === 1) return <Medal size={18} className="text-gray-400" />;
    if (i === 2) return <Award size={18} className="text-amber-600" />;
    return (
      <span className="w-5 h-5 flex items-center justify-center text-xs font-bold text-muted-foreground">
        {i + 1}
      </span>
    );
  };

  return (
    <div className="animate-slide-up space-y-5 pt-2">

      {/* Header com status de conexão */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Comunidade</h1>
        <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
          connected
            ? "bg-green-500/15 text-green-400"
            : "bg-red-500/15 text-red-400"
        }`}>
          {connected
            ? <><Wifi size={12} /> Online</>
            : <><WifiOff size={12} /> Reconectando...</>
          }
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("ranking")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
            tab === "ranking"
              ? "gradient-primary text-primary-foreground glow-primary"
              : "glass-card text-muted-foreground"
          }`}
        >
          <Trophy size={16} /> Ranking
        </button>
        <button
          onClick={() => setTab("chat")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
            tab === "chat"
              ? "gradient-primary text-primary-foreground glow-primary"
              : "glass-card text-muted-foreground"
          }`}
        >
          <MessageCircle size={16} /> Chat
        </button>
      </div>

      {/* ── Ranking ── */}
      {tab === "ranking" && (
        <div className="space-y-3">
          {loadingRanking ? (
            <div className="glass-card p-8 text-center text-muted-foreground text-sm">
              Carregando ranking...
            </div>
          ) : rankingData.length === 0 ? (
            <div className="glass-card p-8 text-center text-muted-foreground text-sm">
              Nenhum resultado ainda. Seja o primeiro a completar o quiz! 🏆
            </div>
          ) : (
            rankingData.map((user, i) => (
              <div
                key={user.name + i}
                className={`glass-card p-4 flex items-center gap-3 ${
                  i === 0 ? "border border-yellow-400/30" : ""
                }`}
              >
                <div className="w-6 flex items-center justify-center shrink-0">
                  {getRankIcon(i)}
                </div>

                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  i === 0
                    ? "gradient-primary text-primary-foreground glow-primary"
                    : "bg-secondary text-foreground"
                }`}>
                  {user.avatar}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{user.name}</p>
                  {user.attempts != null && (
                    <p className="text-xs text-muted-foreground">
                      {user.attempts} quiz{user.attempts !== 1 ? "zes" : ""} feito{user.attempts !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-primary">{user.score} pts</p>
                  {i < 3 && <span className="text-xs text-muted-foreground">Top {i + 1}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Chat ── */}
      {tab === "chat" && (
        <div className="flex flex-col gap-3">
          <div className="glass-card p-4 space-y-3 max-h-[55vh] overflow-y-auto">
            {chatMessages.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-4">
                Nenhuma mensagem ainda. Seja o primeiro! 💬
              </p>
            ) : (
              chatMessages.map((msg, i) => (
                <div key={i} className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-primary">{msg.user}</span>
                    <span className="text-xs text-muted-foreground">{msg.time}</span>
                  </div>
                  <p className="text-sm text-foreground">{msg.msg}</p>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          <div className="flex gap-2">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder={connected ? "Digite sua mensagem..." : "Aguardando conexão..."}
              disabled={!connected}
              className="flex-1 bg-secondary rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={!connected || !message.trim()}
              className="gradient-primary text-primary-foreground p-3 rounded-xl glow-primary active:scale-95 transition-transform disabled:opacity-50"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunityPage;

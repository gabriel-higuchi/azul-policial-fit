import { Trophy, MessageCircle, Send, Crown, Medal, Award } from "lucide-react";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "@/contexts/AuthContext";

// dentro do componente, remova o estado username/hasJoined e adicione:
const socket = io("http://10.253.1.206:3001");

type Message = { user: string; msg: string; time: string };
type RankingUser = { name: string; score: number; avatar: string };

const CommunityPage = () => {
  const { session } = useAuth(); // dentro do componente
  const username = session?.user?.user_metadata?.display_name || session?.user?.email || "Anônimo";
  const [tab, setTab] = useState<"ranking" | "chat">("ranking");
  const [rankingData, setRankingData] = useState<RankingUser[]>([]);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("http://10.253.1.206:3001/api/ranking")
      .then(r => r.json())
      .then(setRankingData);

    socket.on("history", setChatMessages);

    socket.on("message", (msg: Message) => {
      setChatMessages(prev => [...prev, msg]);
    });

    return () => { socket.off("history"); socket.off("message"); };
  }, []);

  const sendMessage = () => {
    if (!message.trim()) return;
    socket.emit("message", { user: username, msg: message });
    setMessage("");
  };

  const getRankIcon = (i: number) => {
    if (i === 0) return <Crown size={18} className="text-accent" />;
    if (i === 1) return <Medal size={18} className="text-muted-foreground" />;
    if (i === 2) return <Award size={18} className="text-amber-700" />;
    return <span className="text-xs font-bold text-muted-foreground w-[18px] text-center">{i + 1}</span>;
  };

  return (
    <div className="animate-slide-up space-y-4 pt-2">
      <h1 className="text-xl font-bold">Comunidade</h1>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("ranking")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
            tab === "ranking" ? "gradient-primary text-primary-foreground glow-primary" : "glass-card text-muted-foreground"
          }`}
        >
          <Trophy size={16} />
          Ranking
        </button>
        <button
          onClick={() => setTab("chat")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
            tab === "chat" ? "gradient-primary text-primary-foreground glow-primary" : "glass-card text-muted-foreground"
          }`}
        >
          <MessageCircle size={16} />
          Chat
        </button>
      </div>

      {/* Ranking */}
      {tab === "ranking" && (
        <div className="space-y-2">
          {rankingData.map((user, i) => (
            <div
              key={user.name}
              className={`glass-card p-3 flex items-center gap-3 ${i < 3 ? "border-primary/20" : ""}`}
            >
              <div className="w-6 flex justify-center">{getRankIcon(i)}</div>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                i === 0 ? "gradient-primary text-primary-foreground" : "bg-secondary text-foreground"
              }`}>
                {user.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{user.name}</p>
                <p className="text-[10px] text-muted-foreground">{user.score} pts</p>
              </div>
              {i < 3 && (
                <span className="text-xs font-bold text-gradient-accent">Top {i + 1}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Chat */}
      {tab === "chat" && (
        <div className="space-y-3">
          <div className="space-y-2 max-h-[55vh] overflow-y-auto">
            {chatMessages.map((msg, i) => (
              <div key={i} className="glass-card p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-primary">{msg.user}</span>
                  <span className="text-[10px] text-muted-foreground">{msg.time}</span>
                </div>
                <p className="text-sm text-foreground/90">{msg.msg}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Digite sua mensagem..."
              className="flex-1 bg-secondary rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={sendMessage}
              className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center shrink-0 active:scale-90 transition-transform"
            >
              <Send size={18} className="text-primary-foreground" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunityPage;
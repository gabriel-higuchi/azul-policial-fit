import { Shield, BookOpen, Timer, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const quickActions = [
  {
    icon: BookOpen,
    label: "Quiz Rápido",
    desc: "10 questões",
    path: "/quiz",
    gradient: true,
  },
  {
    icon: Timer,
    label: "Treino TAF",
    desc: "Corrida",
    path: "/taf",
    gradient: false,
  },
  {
    icon: Trophy,
    label: "Ranking",
    desc: "Top 10",
    path: "/comunidade",
    gradient: false,
  },
];

type Atividade = { title: string; score: string; time: string };

const HomePage = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [stats, setStats] = useState({ questoes: 0, acertos: 0, streak: 0 });
  const [atividades, setAtividades] = useState<Atividade[]>([]);

  useEffect(() => {
    if (!session?.user) return;

    const fetchStats = async () => {
      const { data } = (await supabase
        .from("user_stats")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })) as { data: any[] | null };

      if (!data) return;

      const quizData = data.filter(r => r.type === "quiz");

      // stats
      const questoes = quizData.reduce((acc, r) => acc + (r.total || 0), 0);
      const acertos = quizData.reduce((acc, r) => acc + (r.score || 0), 0);
      const pct = questoes > 0 ? Math.round((acertos / questoes) * 100) : 0;

      // streak
      const dias = new Set(quizData.map(r => new Date(r.created_at).toDateString()));
      let streak = 0;
      const hoje = new Date();
      while (dias.has(new Date(new Date().setDate(hoje.getDate() - streak)).toDateString())) {
        streak++;
      }

      setStats({ questoes, acertos: pct, streak });

      // atividade recente
      const recente = data.slice(0, 5).map(r => {
        const date = new Date(r.created_at);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        const time = diffDays === 0 ? "Hoje" : diffDays === 1 ? "Ontem" : `${diffDays} dias`;

        if (r.type === "quiz") {
          return {
            title: `Quiz - ${r.categoria || "Geral"}`,
            score: `${r.score}/${r.total}`,
            time,
          };
        } else {
          const km = (r.score / 1000).toFixed(2);
          return {
            title: `Corrida ${r.duracao || "?"} min`,
            score: `${km} km`,
            time,
          };
        }
      });

      setAtividades(recente);
    };

    fetchStats();
  }, [session]);

  return (
    <div className="animate-slide-up space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground text-sm">Bem-vindo de volta</p>
          <h1 className="text-2xl font-bold">
            {session?.user?.user_metadata?.display_name || "Cadete"} 💪
          </h1>
        </div>
        <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center">
          <Shield size={20} className="text-primary-foreground" />
        </div>
      </div>

      {/* Stats Card */}
      <div className="glass-card p-5 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Seu progresso</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-gradient-primary">{stats.questoes}</p>
            <p className="text-xs text-muted-foreground">Questões</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gradient-accent">{stats.acertos}%</p>
            <p className="text-xs text-muted-foreground">Acertos</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{stats.streak}</p>
            <p className="text-xs text-muted-foreground">Dias seguidos</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-3">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Ações rápidas</h2>
        <div className="grid grid-cols-3 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.path}
                onClick={() => navigate(action.path)}
                className="glass-card p-4 flex flex-col items-center gap-2 hover:border-primary/30 transition-all active:scale-95"
              >
                <div className={`p-2.5 rounded-xl ${action.gradient ? "gradient-primary glow-primary" : "bg-secondary"}`}>
                  <Icon size={20} className={action.gradient ? "text-primary-foreground" : "text-foreground"} />
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold">{action.label}</p>
                  <p className="text-[10px] text-muted-foreground">{action.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="space-y-3">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Atividade recente</h2>
        <div className="space-y-2">
          {atividades.length === 0 ? (
            <div className="glass-card p-4 text-center text-sm text-muted-foreground">
              Nenhuma atividade ainda. Faça um quiz ou treino! 💪
            </div>
          ) : (
            atividades.map((item, i) => (
              <div key={i} className="glass-card p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.time}</p>
                </div>
                <span className="text-sm font-bold text-primary">{item.score}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default HomePage;
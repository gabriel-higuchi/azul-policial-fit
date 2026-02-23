import { Shield, BookOpen, Timer, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";

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

const HomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="animate-slide-up space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground text-sm">Bem-vindo de volta</p>
          <h1 className="text-2xl font-bold">Cadete 💪</h1>
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
            <p className="text-2xl font-bold text-gradient-primary">127</p>
            <p className="text-xs text-muted-foreground">Questões</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gradient-accent">78%</p>
            <p className="text-xs text-muted-foreground">Acertos</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">5</p>
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
          {[
            { title: "Quiz - Direito Penal", score: "8/10", time: "Hoje" },
            { title: "Corrida 12 min", score: "2.4 km", time: "Ontem" },
            { title: "Quiz - Legislação", score: "7/10", time: "2 dias" },
          ].map((item, i) => (
            <div key={i} className="glass-card p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.time}</p>
              </div>
              <span className="text-sm font-bold text-primary">{item.score}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HomePage;

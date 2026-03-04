import { useEffect, useState } from "react";
import { TrendingUp, Target, Zap, BookOpen, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface StatRow {
  id: string;
  type: string;
  score: number;
  total: number;
  duracao: number;
  categoria: string;
  created_at: string;
}

interface WeekDay {
  label: string;
  questoes: number;
  acertos: number;
  date: Date;
}

interface CategoryStat {
  categoria: string;
  total: number;
  acertos: number;
  pct: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getLast7Days(): WeekDay[] {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      label:    ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][d.getDay()],
      questoes: 0,
      acertos:  0,
      date:     new Date(d.getFullYear(), d.getMonth(), d.getDate()),
    });
  }
  return days;
}

function getLast14Days(): WeekDay[] {
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      label:    `${d.getDate()}/${d.getMonth()+1}`,
      questoes: 0,
      acertos:  0,
      date:     new Date(d.getFullYear(), d.getMonth(), d.getDate()),
    });
  }
  return days;
}

// ─── Componente ───────────────────────────────────────────────────────────────
const StatsPage = () => {
  const { session } = useAuth();
  const [loading, setLoading]       = useState(true);
  const [weekData, setWeekData]     = useState<WeekDay[]>([]);
  const [prevWeek, setPrevWeek]     = useState<WeekDay[]>([]);
  const [catStats, setCatStats]     = useState<CategoryStat[]>([]);
  const [totals, setTotals]         = useState({ questoes: 0, acertos: 0, pct: 0, streak: 0, corridas: 0, kmTotal: 0 });
  const [period, setPeriod]         = useState<"7" | "14">("7");

  useEffect(() => {
    if (!session?.user) return;
    fetchStats();
  }, [session]);

  const fetchStats = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("user_stats")
      .select("*")
      .eq("user_id", session!.user.id)
      .order("created_at", { ascending: true }) as { data: StatRow[] | null };

    if (!data) { setLoading(false); return; }

    const quizData = data.filter((r) => r.type === "quiz");
    const tafData  = data.filter((r) => r.type === "taf");

    // ── Totais gerais ────────────────────────────────────────────────────────
    const totalQ = quizData.reduce((a, r) => a + (r.total || 0), 0);
    const totalA = quizData.reduce((a, r) => a + (r.score || 0), 0);
    const pct    = totalQ > 0 ? Math.round((totalA / totalQ) * 100) : 0;
    const kmTotal = tafData.reduce((a, r) => a + (r.score || 0), 0) / 1000;

    // Streak
    const diasSet = new Set(quizData.map((r) => new Date(r.created_at).toDateString()));
    let streak = 0;
    while (diasSet.has(new Date(new Date().setDate(new Date().getDate() - streak)).toDateString())) streak++;

    setTotals({ questoes: totalQ, acertos: totalA, pct, streak, corridas: tafData.length, kmTotal });

    // ── Evolução semanal ─────────────────────────────────────────────────────
    const week7  = getLast7Days();
    const week14 = getLast14Days();

    quizData.forEach((r) => {
      const d = new Date(r.created_at);
      const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

      // Últimos 7 dias
      const idx7 = week7.findIndex((w) => w.date.getTime() === dateOnly);
      if (idx7 >= 0) {
        week7[idx7].questoes += r.total || 0;
        week7[idx7].acertos  += r.score || 0;
      }
      // Últimos 14 dias
      const idx14 = week14.findIndex((w) => w.date.getTime() === dateOnly);
      if (idx14 >= 0) {
        week14[idx14].questoes += r.total || 0;
        week14[idx14].acertos  += r.score || 0;
      }
    });

    setWeekData(week7);
    setPrevWeek(week14);

    // ── Por categoria ────────────────────────────────────────────────────────
    const catMap = new Map<string, { total: number; acertos: number }>();
    quizData.forEach((r) => {
      const cat = r.categoria || "Geral";
      const cur = catMap.get(cat) || { total: 0, acertos: 0 };
      catMap.set(cat, { total: cur.total + (r.total || 0), acertos: cur.acertos + (r.score || 0) });
    });

    const cats: CategoryStat[] = Array.from(catMap.entries())
      .map(([categoria, { total, acertos }]) => ({
        categoria,
        total,
        acertos,
        pct: total > 0 ? Math.round((acertos / total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    setCatStats(cats);
    setLoading(false);
  };

  // ── Comparativo semana atual vs anterior ─────────────────────────────────
  const currentWeekQ = weekData.reduce((a, d) => a + d.questoes, 0);
  const prevWeekQ    = prevWeek.slice(0, 7).reduce((a, d) => a + d.questoes, 0);
  const weekDiff     = prevWeekQ > 0 ? Math.round(((currentWeekQ - prevWeekQ) / prevWeekQ) * 100) : 0;

  const displayData  = period === "7" ? weekData : prevWeek;
  const maxQ         = Math.max(...displayData.map((d) => d.questoes), 1);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full gradient-primary animate-pulse" />
    </div>
  );

  return (
    <div className="animate-slide-up space-y-6 pt-2">
      <div>
        <h1 className="text-xl font-bold">Estatísticas</h1>
        <p className="text-xs text-muted-foreground">Seu desempenho detalhado</p>
      </div>

      {/* Cards de totais */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: BookOpen, label: "Questões",      value: totals.questoes,            color: "text-primary" },
          { icon: Target,   label: "Taxa de acerto", value: `${totals.pct}%`,           color: "text-green-400" },
          { icon: Zap,      label: "Dias seguidos",  value: `${totals.streak} dias`,    color: "text-accent" },
          { icon: Award,    label: "Km rodados",     value: `${totals.kmTotal.toFixed(1)} km`, color: "text-purple-400" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="glass-card p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Icon size={16} className={color} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
            <p className={`text-2xl font-black ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Comparativo semanal */}
      <div className="glass-card p-4 space-y-1">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className={weekDiff >= 0 ? "text-green-400" : "text-destructive"} />
          <span className="text-sm font-semibold">Comparativo semanal</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Esta semana: <span className="text-foreground font-semibold">{currentWeekQ} questões</span>
          {prevWeekQ > 0 && (
            <span className={`ml-2 font-semibold ${weekDiff >= 0 ? "text-green-400" : "text-destructive"}`}>
              {weekDiff >= 0 ? "▲" : "▼"} {Math.abs(weekDiff)}% vs semana passada
            </span>
          )}
        </p>
      </div>

      {/* Gráfico de evolução */}
      <div className="glass-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Evolução — questões por dia
          </h2>
          <div className="flex gap-1">
            {(["7", "14"] as const).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${period === p ? "gradient-primary text-primary-foreground" : "glass-card text-muted-foreground"}`}>
                {p}d
              </button>
            ))}
          </div>
        </div>

        {/* Barras */}
        <div className="flex items-end gap-1.5 h-32">
          {displayData.map((day, i) => {
            const heightPct = maxQ > 0 ? (day.questoes / maxQ) * 100 : 0;
            const acertoPct = day.questoes > 0 ? (day.acertos / day.questoes) * 100 : 0;
            const isToday   = i === displayData.length - 1 && period === "7";
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col justify-end" style={{ height: 96 }}>
                  {day.questoes > 0 && (
                    <div className="relative w-full rounded-t-md overflow-hidden"
                      style={{ height: `${Math.max(heightPct, 6)}%` }}>
                      {/* Barra de fundo (total) */}
                      <div className="absolute inset-0 bg-primary/20 rounded-t-md" />
                      {/* Barra de acertos */}
                      <div className="absolute bottom-0 left-0 right-0 gradient-primary rounded-t-md"
                        style={{ height: `${acertoPct}%` }} />
                    </div>
                  )}
                  {day.questoes === 0 && (
                    <div className="w-full rounded-t-md bg-secondary/40" style={{ height: 4 }} />
                  )}
                </div>
                <span className={`text-[9px] font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                  {day.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Legenda */}
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-2 rounded-sm gradient-primary inline-block" /> Acertos
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-2 rounded-sm bg-primary/20 inline-block" /> Total
          </span>
        </div>
      </div>

      {/* Taxa de acerto por matéria */}
      <div className="glass-card p-4 space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Desempenho por matéria
        </h2>

        {catStats.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Faça quizzes para ver seu desempenho por matéria!
          </p>
        ) : (
          <div className="space-y-3">
            {catStats.map((cat) => {
              const color =
                cat.pct >= 70 ? "bg-green-400" :
                cat.pct >= 50 ? "bg-primary"   :
                cat.pct >= 30 ? "bg-accent"    : "bg-destructive";
              const textColor =
                cat.pct >= 70 ? "text-green-400" :
                cat.pct >= 50 ? "text-primary"   :
                cat.pct >= 30 ? "text-accent"    : "text-destructive";

              return (
                <div key={cat.categoria} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate pr-2">{cat.categoria}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">{cat.acertos}/{cat.total}</span>
                      <span className={`text-sm font-bold ${textColor}`}>{cat.pct}%</span>
                    </div>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${color}`}
                      style={{ width: `${cat.pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Resumo de corridas */}
      {totals.corridas > 0 && (
        <div className="glass-card p-4 space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Resumo TAF
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{totals.corridas}</p>
              <p className="text-xs text-muted-foreground">Corridas</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{totals.kmTotal.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">km totais</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatsPage;

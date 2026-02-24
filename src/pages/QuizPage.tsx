import { useState } from "react";
import { CheckCircle, XCircle, ArrowRight, RotateCcw, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { socket } from "@/lib/socket";

interface Question {
  id: string;
  question: string;
  options: string[];
  correct: number;
  category: string;
  area: string;
}

const AREAS = [
  { id: "PRF", label: "PRF", desc: "Polícia Rodoviária Federal", color: "text-blue-400" },
  { id: "PF",  label: "PF",  desc: "Polícia Federal",            color: "text-yellow-400" },
  { id: "PC",  label: "PC",  desc: "Polícia Civil",              color: "text-green-400" },
  { id: "PL",  label: "PL",  desc: "Polícia Legislativa",        color: "text-purple-400" },
  { id: "PM",  label: "PM",  desc: "Polícia Militar",            color: "text-red-400" },
  { id: "PP",  label: "PP",  desc: "Polícia Penal",              color: "text-orange-400" },
];

const QuizPage = () => {
  const { session } = useAuth();

  const [area, setArea]         = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading]   = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore]       = useState(0);
  const [answered, setAnswered] = useState(false);
  const [finished, setFinished] = useState(false);
  const [saving, setSaving]     = useState(false);

  const q = questions[currentQ];

  // ── Carrega 10 perguntas da área escolhida ──────────────────────────────────
  const startQuiz = async (selectedArea: string) => {
    setLoading(true);
    setArea(selectedArea);

    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .eq("area", selectedArea)
      .limit(10);

    if (error) {
      console.error("Erro ao buscar questões:", error);
      setLoading(false);
      return;
    }

    // Embaralha para não vir sempre na mesma ordem
    const shuffled = [...(data || [])].sort(() => Math.random() - 0.5);
    setQuestions(shuffled);
    setLoading(false);
  };

  // ── Responde uma questão ────────────────────────────────────────────────────
  const handleSelect = (index: number) => {
    if (answered) return;
    setSelected(index);
    setAnswered(true);
    if (index === q.correct) setScore((s) => s + 1);
  };

  // ── Avança ou finaliza ──────────────────────────────────────────────────────
  const handleNext = async () => {
    if (currentQ < questions.length - 1) {
      setCurrentQ((c) => c + 1);
      setSelected(null);
      setAnswered(false);
    } else {
      setFinished(true);
      await saveStats();
    }
  };

  // ── Salva resultado ─────────────────────────────────────────────────────────
  const saveStats = async () => {
    if (!session?.user) return;
    setSaving(true);

    await supabase.from("user_stats").insert({
      user_id:  session.user.id,
      type:     "quiz",
      score:    score,
      total:    questions.length,
      categoria: area,
    });

    const name =
      session.user.user_metadata?.display_name ||
      session.user.email ||
      "Anônimo";

    socket.emit("submitScore", {
      userId: session.user.id,
      name,
      score,
      total: questions.length,
    });

    setSaving(false);
  };

  // ── Reinicia tudo ───────────────────────────────────────────────────────────
  const handleRestart = () => {
    setArea(null);
    setQuestions([]);
    setCurrentQ(0);
    setSelected(null);
    setScore(0);
    setAnswered(false);
    setFinished(false);
  };

  // ── Tela: seleção de área ───────────────────────────────────────────────────
  if (!area || loading) {
    return (
      <div className="animate-slide-up space-y-6 pt-2">
        <div>
          <h1 className="text-xl font-bold">Quiz</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Selecione a área que você está estudando
          </p>
        </div>

        {loading ? (
          <div className="glass-card p-8 text-center text-muted-foreground text-sm">
            Carregando questões...
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {AREAS.map((a) => (
              <button
                key={a.id}
                onClick={() => startQuiz(a.id)}
                className="glass-card p-5 flex flex-col items-center gap-2 active:scale-95 transition-all hover:border-primary/40"
              >
                <Shield size={28} className={a.color} />
                <span className="text-lg font-black">{a.label}</span>
                <span className="text-xs text-muted-foreground text-center leading-tight">
                  {a.desc}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Tela: resultado ─────────────────────────────────────────────────────────
  if (finished) {
    const pct    = Math.round((score / questions.length) * 100);
    const points = Math.round((score / questions.length) * 1000);
    const areaInfo = AREAS.find((a) => a.id === area);

    return (
      <div className="animate-slide-up space-y-6 pt-4">
        <div className="glass-card p-8 text-center space-y-4">
          <div className="w-20 h-20 rounded-full gradient-primary glow-primary flex items-center justify-center mx-auto">
            <span className="text-2xl font-black text-primary-foreground">{pct}%</span>
          </div>
          <h2 className="text-xl font-bold">Quiz Finalizado!</h2>
          <p className="text-sm text-muted-foreground">
            Área: <span className={`font-bold ${areaInfo?.color}`}>{areaInfo?.desc}</span>
          </p>
          <p className="text-muted-foreground">
            Você acertou{" "}
            <span className="text-primary font-bold">{score}</span> de{" "}
            <span className="font-bold">{questions.length}</span> questões
          </p>
          <p className="text-sm font-semibold text-primary">
            +{points} pts adicionados ao ranking 🏆
          </p>
          {saving && (
            <p className="text-xs text-muted-foreground">Salvando resultado...</p>
          )}
          <button
            onClick={handleRestart}
            className="gradient-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold flex items-center gap-2 mx-auto active:scale-95 transition-transform"
          >
            <RotateCcw size={18} />
            Escolher outra área
          </button>
        </div>
      </div>
    );
  }

  // ── Tela: questão ───────────────────────────────────────────────────────────
  const areaInfo = AREAS.find((a) => a.id === area);

  return (
    <div className="animate-slide-up space-y-5 pt-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Quiz — {area}</h1>
          <p className="text-xs text-muted-foreground">{q.category}</p>
        </div>
        <span className="text-sm font-semibold text-primary">
          {currentQ + 1}/{questions.length}
        </span>
      </div>

      {/* Progress */}
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full gradient-primary rounded-full transition-all duration-300"
          style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }}
        />
      </div>

      {/* Question */}
      <div className="glass-card p-5">
        <p className="text-sm font-medium leading-relaxed">{q.question}</p>
      </div>

      {/* Options */}
      <div className="space-y-2.5">
        {q.options.map((opt, i) => {
          let style = "glass-card";
          if (answered) {
            if (i === q.correct)                  style = "border-green-500 bg-green-500/10 border";
            else if (i === selected)              style = "border-destructive bg-destructive/10 border";
            else                                  style = "glass-card opacity-50";
          }
          return (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              className={`w-full p-4 rounded-xl text-left text-sm font-medium flex items-center gap-3 transition-all active:scale-[0.98] ${style}`}
            >
              <span className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-xs font-bold shrink-0">
                {String.fromCharCode(65 + i)}
              </span>
              <span className="flex-1">{opt}</span>
              {answered && i === q.correct && (
                <CheckCircle size={18} className="text-green-500 shrink-0" />
              )}
              {answered && i === selected && i !== q.correct && (
                <XCircle size={18} className="text-destructive shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Next */}
      {answered && (
        <button
          onClick={handleNext}
          className="w-full gradient-primary text-primary-foreground py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform glow-primary"
        >
          {currentQ < questions.length - 1 ? "Próxima" : "Ver resultado"}
          <ArrowRight size={18} />
        </button>
      )}
    </div>
  );
};

export default QuizPage;

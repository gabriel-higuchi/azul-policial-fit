import { useState } from "react";
import { CheckCircle, XCircle, ArrowRight, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Question {
  id: number;
  question: string;
  options: string[];
  correct: number;
  category: string;
}

const questions: Question[] = [
  {
    id: 1,
    question: "Qual é o prazo máximo de duração do inquérito policial quando o indiciado está preso?",
    options: ["10 dias", "15 dias", "30 dias", "60 dias"],
    correct: 0,
    category: "Direito Processual Penal",
  },
  {
    id: 2,
    question: "A legítima defesa é uma causa excludente de:",
    options: ["Tipicidade", "Ilicitude", "Culpabilidade", "Punibilidade"],
    correct: 1,
    category: "Direito Penal",
  },
  {
    id: 3,
    question: "Segundo a CF/88, a segurança pública é dever do Estado e:",
    options: [
      "Responsabilidade exclusiva da polícia",
      "Direito e responsabilidade de todos",
      "Obrigação dos municípios",
      "Competência federal",
    ],
    correct: 1,
    category: "Direito Constitucional",
  },
  {
    id: 4,
    question: "O flagrante delito pode ser classificado como próprio quando:",
    options: [
      "O agente é encontrado com instrumentos do crime",
      "O agente está cometendo ou acaba de cometer o crime",
      "O agente é perseguido logo após o crime",
      "O agente confessa a prática do crime",
    ],
    correct: 1,
    category: "Direito Processual Penal",
  },
  {
    id: 5,
    question: "A Polícia Federal é organizada e mantida pela:",
    options: ["União", "Estados", "Municípios", "Distrito Federal"],
    correct: 0,
    category: "Direito Constitucional",
  },
];

const QuizPage = () => {
  const { session } = useAuth();
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);

  const q = questions[currentQ];

  const handleSelect = (index: number) => {
    if (answered) return;
    setSelected(index);
    setAnswered(true);
    if (index === q.correct) setScore((s) => s + 1);
  };

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

  const saveStats = async () => {
    if (!session?.user) return;
    setSaving(true);
    await supabase.from("user_stats").insert({
      user_id: session.user.id,
      type: "quiz",
      score: score,
      total: questions.length,
      categoria: q.category,
    });
    setSaving(false);
    const saveStats = async () => {
  if (!session?.user) {
    console.log("sem sessão");
    return;
  }
  setSaving(true);

  const { error, data } = await supabase.from("user_stats").insert({
    user_id: session.user.id,
    type: "quiz",
    score: score,
    total: questions.length,
    categoria: q.category,
  }).select();

  console.log("insert resultado:", data, error);
  setSaving(false);
};
  };

  const handleRestart = () => {
    setCurrentQ(0);
    setSelected(null);
    setScore(0);
    setAnswered(false);
    setFinished(false);
  };

  if (finished) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="animate-slide-up space-y-6 pt-4">
        <div className="glass-card p-8 text-center space-y-4">
          <div className="w-20 h-20 rounded-full gradient-primary glow-primary flex items-center justify-center mx-auto">
            <span className="text-2xl font-black text-primary-foreground">{pct}%</span>
          </div>
          <h2 className="text-xl font-bold">Quiz Finalizado!</h2>
          <p className="text-muted-foreground">
            Você acertou <span className="text-primary font-bold">{score}</span> de{" "}
            <span className="font-bold">{questions.length}</span> questões
          </p>
          {saving && <p className="text-xs text-muted-foreground">Salvando resultado...</p>}
          <button
            onClick={handleRestart}
            className="gradient-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold flex items-center gap-2 mx-auto active:scale-95 transition-transform"
          >
            <RotateCcw size={18} />
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-slide-up space-y-5 pt-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Quiz</h1>
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
            if (i === q.correct) style = "border-green-500 bg-green-500/10 border";
            else if (i === selected) style = "border-destructive bg-destructive/10 border";
            else style = "glass-card opacity-50";
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
              {answered && i === q.correct && <CheckCircle size={18} className="text-green-500 shrink-0" />}
              {answered && i === selected && i !== q.correct && <XCircle size={18} className="text-destructive shrink-0" />}
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
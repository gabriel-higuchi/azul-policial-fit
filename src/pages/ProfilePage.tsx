import { useState, useEffect } from "react";
import {
  Shield, ChevronRight, Bell, Moon, HelpCircle,
  LogOut, Star, X, Sun, Check, ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ModalType = "metas" | "aparencia" | "ajuda" | null;

interface Goals {
  targetScore: number;
  focusArea: string;
  studyDays: number[];
}

const AREAS = ["PRF", "PF", "PC", "PL", "PM", "PP"];
const DAYS  = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const ACCENT_COLORS = [
  { label: "Azul",    value: "blue",   hex: "#3b82f6" },
  { label: "Verde",   value: "green",  hex: "#22c55e" },
  { label: "Roxo",    value: "purple", hex: "#a855f7" },
  { label: "Laranja", value: "orange", hex: "#f97316" },
  { label: "Ciano",   value: "cyan",   hex: "#06b6d4" },
  { label: "Rosa",    value: "pink",   hex: "#ec4899" },
];

const FAQ = [
  { q: "Como funciona o ranking?", a: "O ranking acumula pontos de cada quiz. Cada questão certa vale pontos proporcionais — um quiz perfeito vale 1000 pts. Os pontos somam a cada quiz feito." },
  { q: "Posso refazer o quiz?", a: "Sim! Você pode fazer o quiz quantas vezes quiser. Cada tentativa soma pontos ao seu total no ranking." },
  { q: "Como trocar de área no quiz?", a: "Na tela do Quiz, clique em 'Escolher outra área' ao finalizar, ou reinicie pelo botão de restart para selecionar PRF, PF, PC, PL, PM ou PP." },
  { q: "Minhas metas ficam salvas?", a: "Sim, as metas são salvas localmente no seu dispositivo e permanecem entre sessões." },
  { q: "Como mudar o tema?", a: "Acesse Perfil → Aparência e escolha entre tema claro ou escuro, e a cor de destaque preferida." },
  { q: "Preciso de internet para usar?", a: "Sim, o app precisa de conexão para carregar as questões do banco de dados e sincronizar o ranking e o chat em tempo real." },
];

// ─── Persistência local simples ───────────────────────────────────────────────

function loadGoals(): Goals {
  try {
    const raw = localStorage.getItem("user_goals");
    if (raw) return JSON.parse(raw);
  } catch {}
  return { targetScore: 5000, focusArea: "PRF", studyDays: [1, 2, 3, 4, 5] };
}

function saveGoals(g: Goals) {
  localStorage.setItem("user_goals", JSON.stringify(g));
}

function loadAppearance() {
  try {
    const raw = localStorage.getItem("user_appearance");
    if (raw) return JSON.parse(raw);
  } catch {}
  return { theme: "dark", accent: "blue" };
}

function saveAppearance(a: { theme: string; accent: string }) {
  localStorage.setItem("user_appearance", JSON.stringify(a));
}

function applyTheme(theme: string, accent: string) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.setAttribute("data-accent", accent);
  if (theme === "light") {
    root.classList.add("light");
    root.classList.remove("dark");
  } else {
    root.classList.add("dark");
    root.classList.remove("light");
  }
}

// ─── Componente principal ─────────────────────────────────────────────────────

const ProfilePage = () => {
  const navigate  = useNavigate();
  const { session } = useAuth();

  const user        = session?.user;
  const displayName = user?.user_metadata?.display_name || "Cadete";
  const email       = user?.email || "";

  const [modal, setModal]   = useState<ModalType>(null);
  const [goals, setGoals]   = useState<Goals>(loadGoals);
  const [appear, setAppear] = useState(loadAppearance);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Aplica tema ao montar
  useEffect(() => {
    applyTheme(appear.theme, appear.accent);
  }, []);

  const closeModal = () => setModal(null);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ title: "Erro ao sair", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Você saiu da conta 👋" });
    navigate("/auth");
  };

  const handleMenuClick = (label: string) => {
    if (label === "Sair")       return handleLogout();
    if (label === "Metas")      return setModal("metas");
    if (label === "Aparência")  return setModal("aparencia");
    if (label === "Ajuda")      return setModal("ajuda");
    // Notificações: futuramente
  };

  const menuItems = [
    { icon: Bell,        label: "Notificações", desc: "Gerenciar alertas" },
    { icon: Star,        label: "Metas",        desc: "Definir objetivos" },
    { icon: Moon,        label: "Aparência",    desc: "Tema e cor" },
    { icon: HelpCircle,  label: "Ajuda",        desc: "FAQ e suporte" },
    { icon: LogOut,      label: "Sair",         desc: "Desconectar conta" },
  ];

  // ── Save Metas ──────────────────────────────────────────────────────────────
  const handleSaveGoals = () => {
    saveGoals(goals);
    toast({ title: "Metas salvas! 🎯" });
    closeModal();
  };

  const toggleDay = (d: number) => {
    setGoals((g) => ({
      ...g,
      studyDays: g.studyDays.includes(d)
        ? g.studyDays.filter((x) => x !== d)
        : [...g.studyDays, d],
    }));
  };

  // ── Save Aparência ──────────────────────────────────────────────────────────
  const handleSaveAppearance = () => {
    saveAppearance(appear);
    applyTheme(appear.theme, appear.accent);
    toast({ title: "Aparência atualizada! 🎨" });
    closeModal();
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="animate-slide-up space-y-6 pt-2">
      <h1 className="text-xl font-bold">Perfil</h1>

      {/* Card do usuário */}
      <div className="glass-card p-6 flex flex-col items-center gap-4">
        <div className="w-20 h-20 rounded-full gradient-primary glow-primary flex items-center justify-center">
          <Shield size={36} className="text-primary-foreground" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-bold">{displayName}</h2>
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>
      </div>

      {/* Menu */}
      <div className="space-y-1.5">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              onClick={() => handleMenuClick(item.label)}
              className="w-full glass-card p-3.5 flex items-center gap-3 hover:border-primary/20 transition-all active:scale-[0.98]"
            >
              <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center">
                <Icon size={18} className="text-foreground" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-[10px] text-muted-foreground">{item.desc}</p>
              </div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>
          );
        })}
      </div>

      {/* ── OVERLAY ── */}
      {modal && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div
            className="glass-card w-full max-w-md rounded-2xl p-6 space-y-5 overflow-y-auto"
            style={{ maxHeight: "calc(100dvh - 48px)" }}
            onClick={(e) => e.stopPropagation()}
          >

            {/* ── MODAL: METAS ── */}
            {modal === "metas" && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Star size={20} className="text-primary" /> Minhas Metas
                  </h2>
                  <button onClick={closeModal}><X size={20} /></button>
                </div>

                {/* Pontuação alvo */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold">🏆 Pontuação alvo</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={1000} max={50000} step={500}
                      value={goals.targetScore}
                      onChange={(e) => setGoals((g) => ({ ...g, targetScore: +e.target.value }))}
                      className="flex-1 accent-primary"
                    />
                    <span className="text-sm font-bold text-primary w-20 text-right">
                      {goals.targetScore.toLocaleString("pt-BR")} pts
                    </span>
                  </div>
                </div>

                {/* Área foco */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold">🎯 Área foco</label>
                  <div className="grid grid-cols-3 gap-2">
                    {AREAS.map((a) => (
                      <button
                        key={a}
                        onClick={() => setGoals((g) => ({ ...g, focusArea: a }))}
                        className={`py-2 rounded-xl text-sm font-bold transition-all ${
                          goals.focusArea === a
                            ? "gradient-primary text-primary-foreground glow-primary"
                            : "glass-card text-muted-foreground"
                        }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dias de estudo */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold">📅 Dias de estudo</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {DAYS.map((d, i) => (
                      <button
                        key={d}
                        onClick={() => toggleDay(i)}
                        className={`w-10 h-10 rounded-xl text-xs font-bold transition-all ${
                          goals.studyDays.includes(i)
                            ? "gradient-primary text-primary-foreground"
                            : "glass-card text-muted-foreground"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {goals.studyDays.length} dia{goals.studyDays.length !== 1 ? "s" : ""} por semana
                  </p>
                </div>

                <button
                  onClick={handleSaveGoals}
                  className="w-full gradient-primary text-primary-foreground py-3 rounded-xl font-semibold glow-primary active:scale-95 transition-transform"
                >
                  Salvar Metas
                </button>
              </>
            )}

            {/* ── MODAL: APARÊNCIA ── */}
            {modal === "aparencia" && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Moon size={20} className="text-primary" /> Aparência
                  </h2>
                  <button onClick={closeModal}><X size={20} /></button>
                </div>

                {/* Tema */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold">🌗 Tema</label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setAppear((a) => ({ ...a, theme: "dark" }))}
                      className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-all ${
                        appear.theme === "dark"
                          ? "gradient-primary text-primary-foreground glow-primary"
                          : "glass-card text-muted-foreground"
                      }`}
                    >
                      <Moon size={16} /> Escuro
                      {appear.theme === "dark" && <Check size={14} />}
                    </button>
                    <button
                      onClick={() => setAppear((a) => ({ ...a, theme: "light" }))}
                      className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-all ${
                        appear.theme === "light"
                          ? "gradient-primary text-primary-foreground glow-primary"
                          : "glass-card text-muted-foreground"
                      }`}
                    >
                      <Sun size={16} /> Claro
                      {appear.theme === "light" && <Check size={14} />}
                    </button>
                  </div>
                </div>

                {/* Cor de destaque */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold">🎨 Cor de destaque</label>
                  <div className="grid grid-cols-3 gap-2">
                    {ACCENT_COLORS.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => setAppear((a) => ({ ...a, accent: c.value }))}
                        className={`py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold transition-all glass-card ${
                          appear.accent === c.value ? "border-2 border-white/40" : ""
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded-full shrink-0"
                          style={{ backgroundColor: c.hex }}
                        />
                        {c.label}
                        {appear.accent === c.value && <Check size={12} />}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleSaveAppearance}
                  className="w-full gradient-primary text-primary-foreground py-3 rounded-xl font-semibold glow-primary active:scale-95 transition-transform"
                >
                  Aplicar
                </button>
              </>
            )}

            {/* ── MODAL: AJUDA ── */}
            {modal === "ajuda" && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <HelpCircle size={20} className="text-primary" /> Ajuda
                  </h2>
                  <button onClick={closeModal}><X size={20} /></button>
                </div>

                <p className="text-xs text-muted-foreground">
                  Perguntas frequentes sobre o app
                </p>

                <div className="space-y-2">
                  {FAQ.map((item, i) => (
                    <div key={i} className="glass-card rounded-xl overflow-hidden">
                      <button
                        onClick={() => setOpenFaq(openFaq === i ? null : i)}
                        className="w-full p-4 flex items-center justify-between gap-3 text-left"
                      >
                        <span className="text-sm font-semibold">{item.q}</span>
                        <ChevronDown
                          size={16}
                          className={`shrink-0 text-muted-foreground transition-transform ${
                            openFaq === i ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                      {openFaq === i && (
                        <div className="px-4 pb-4">
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {item.a}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="glass-card p-4 rounded-xl text-center space-y-1">
                  <p className="text-sm font-semibold">Ainda precisa de ajuda?</p>
                  <p className="text-xs text-muted-foreground">
                    Entre em contato pelo e-mail{" "}
                    <span className="text-primary font-medium">suporte@apppolicial.com</span>
                  </p>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;

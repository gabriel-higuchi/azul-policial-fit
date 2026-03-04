import { useState, useEffect, useRef, useCallback } from "react";
import {
  Shield, ChevronRight, Bell, Moon, HelpCircle,
  LogOut, Star, X, Sun, Check, ChevronDown, Camera, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { globalCache } from "@/lib/socket";

type ModalType = "metas" | "aparencia" | "ajuda" | null;
interface Goals { targetScore: number; focusArea: string; studyDays: number[]; }

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
  { q: "Como funciona o ranking?",     a: "O ranking acumula pontos de cada quiz. Cada questão certa vale pontos proporcionais — um quiz perfeito vale 1000 pts." },
  { q: "Posso refazer o quiz?",        a: "Sim! Você pode fazer o quiz quantas vezes quiser. Cada tentativa soma pontos ao seu total no ranking." },
  { q: "Como trocar de área no quiz?", a: "Na tela do Quiz, clique em 'Escolher outra área' ao finalizar para selecionar PRF, PF, PC, PL, PM ou PP." },
  { q: "Minhas metas ficam salvas?",   a: "Sim, as metas são salvas localmente no seu dispositivo e permanecem entre sessões." },
  { q: "Como mudar o tema?",           a: "Acesse Perfil → Aparência e escolha entre tema claro ou escuro, e a cor de destaque preferida." },
  { q: "Preciso de internet?",         a: "Sim, o app precisa de conexão para carregar as questões e sincronizar o ranking e o chat." },
];

function loadGoals(): Goals {
  try { const r = localStorage.getItem("user_goals"); if (r) return JSON.parse(r); } catch {}
  return { targetScore: 5000, focusArea: "PRF", studyDays: [1, 2, 3, 4, 5] };
}
function saveGoals(g: Goals) { localStorage.setItem("user_goals", JSON.stringify(g)); }
function loadAppearance() {
  try { const r = localStorage.getItem("user_appearance"); if (r) return JSON.parse(r); } catch {}
  return { theme: "dark", accent: "blue" };
}
function saveAppearance(a: { theme: string; accent: string }) {
  localStorage.setItem("user_appearance", JSON.stringify(a));
}
function applyTheme(theme: string, accent: string) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.setAttribute("data-accent", accent);
  if (theme === "light") { root.classList.add("light"); root.classList.remove("dark"); }
  else { root.classList.add("dark"); root.classList.remove("light"); }
}

const ProfilePage = () => {
  const navigate    = useNavigate();
  const { session } = useAuth();
  const user        = session?.user;
  const displayName = user?.user_metadata?.display_name || "Cadete";
  const email       = user?.email || "";
  const username    =
    user?.user_metadata?.display_name ||
    user?.email?.split("@")[0] ||
    "Anônimo";

  const [modal, setModal]         = useState<ModalType>(null);
  const [goals, setGoals]         = useState<Goals>(loadGoals);
  const [appear, setAppear]       = useState(loadAppearance);
  const [openFaq, setOpenFaq]     = useState<number | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Para forçar re-render do progresso ao abrir o modal
  const [weekScore, setWeekScore] = useState({ quiz: 0, taf: 0 });

  const calcWeekScore = useCallback(() => {
  const quizScore = globalCache.ranking.find(r => r.name === username)?.score ?? 0;
  const tafEntries = globalCache.tafRanking.filter(r => r.name === username);
  const tafScore = tafEntries.reduce((sum, r) => {
    if (r.type === "Corrida") return sum + Math.round(r.score / 10);
    return sum + r.score * 10;
  }, 0);
  setWeekScore({ quiz: quizScore, taf: tafScore });
}, [username]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { applyTheme(appear.theme, appear.accent); }, []);

  useEffect(() => {
    if (!user?.id) return;
    const { data } = supabase.storage.from("avatars").getPublicUrl(`${user.id}.jpg`);
    const ts = localStorage.getItem(`avatar_ts_${user.id}`);
    if (ts) setAvatarUrl(`${data.publicUrl}?t=${ts}`);
  }, [user?.id]);

  // Recalcula pontuação da semana ao abrir modal de metas
  useEffect(() => {
    calcWeekScore();
    globalCache.listeners.add(calcWeekScore);
    return () => {
      globalCache.listeners.delete(calcWeekScore);
    };
  }, [calcWeekScore]);

    const closeModal = () => setModal(null);

  // ── Upload de avatar ──────────────────────────────────────────────────────
  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Arquivo inválido", description: "Selecione uma imagem.", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Imagem muito grande", description: "Máximo 2MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const bitmap  = await createImageBitmap(file);
      const canvas  = document.createElement("canvas");
      const MAX     = 400;
      const ratio   = Math.min(MAX / bitmap.width, MAX / bitmap.height);
      canvas.width  = Math.round(bitmap.width  * ratio);
      canvas.height = Math.round(bitmap.height * ratio);
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((res) =>
        canvas.toBlob((b) => res(b!), "image/jpeg", 0.85)
      );
      const { error } = await supabase.storage
        .from("avatars")
        .upload(`${user.id}.jpg`, blob, { upsert: true, contentType: "image/jpeg" });
      if (error) throw error;
      const ts = Date.now().toString();
      localStorage.setItem(`avatar_ts_${user.id}`, ts);
      const { data } = supabase.storage.from("avatars").getPublicUrl(`${user.id}.jpg`);
      setAvatarUrl(`${data.publicUrl}?t=${ts}`);
      toast({ title: "Foto atualizada! 📸" });
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) { toast({ title: "Erro ao sair", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Você saiu da conta 👋" });
    navigate("/auth");
  };

  const handleMenuClick = (label: string) => {
    if (label === "Sair")      return handleLogout();
    if (label === "Metas")     return setModal("metas");
    if (label === "Aparência") return setModal("aparencia");
    if (label === "Ajuda")     return setModal("ajuda");
  };

  const menuItems = [
    { icon: Bell,       label: "Notificações", desc: "Gerenciar alertas" },
    { icon: Star,       label: "Metas",        desc: "Definir objetivos" },
    { icon: Moon,       label: "Aparência",    desc: "Tema e cor"        },
    { icon: HelpCircle, label: "Ajuda",        desc: "FAQ e suporte"     },
    { icon: LogOut,     label: "Sair",         desc: "Desconectar conta" },
  ];

  const handleSaveGoals = () => { saveGoals(goals); toast({ title: "Metas salvas! 🎯" }); closeModal(); };
  const toggleDay = (d: number) => setGoals((g) => ({
    ...g, studyDays: g.studyDays.includes(d) ? g.studyDays.filter((x) => x !== d) : [...g.studyDays, d],
  }));
  const handleSaveAppearance = () => {
    saveAppearance(appear); applyTheme(appear.theme, appear.accent);
    toast({ title: "Aparência atualizada! 🎨" }); closeModal();
  };

  const totalScore = weekScore.quiz + weekScore.taf;
  const progress = Math.min(100, Math.round((totalScore / goals.targetScore) * 100));

  return (
    <div className="animate-slide-up space-y-6 pt-2">
      <h1 className="text-xl font-bold">Perfil</h1>

      {/* Card do usuário */}
      <div className="glass-card p-6 flex flex-col items-center gap-4">
        <div className="relative">
          <div
            onClick={handleAvatarClick}
            className="w-24 h-24 rounded-full gradient-primary glow-primary flex items-center justify-center overflow-hidden cursor-pointer"
          >
            {uploading ? (
              <Loader2 size={32} className="text-primary-foreground animate-spin" />
            ) : avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <Shield size={40} className="text-primary-foreground" />
            )}
          </div>
          <button
            onClick={handleAvatarClick}
            disabled={uploading}
            className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary border-2 border-background flex items-center justify-center shadow-lg"
          >
            <Camera size={14} className="text-primary-foreground" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-bold">{displayName}</h2>
          <p className="text-sm text-muted-foreground">{email}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Toque na foto para alterar</p>
        </div>

        {/* Mini progresso semanal no card do usuário */}
        <div className="w-full space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Meta semanal</span>
            <span className="font-semibold text-primary">{totalScore} / {goals.targetScore.toLocaleString("pt-BR")} pts</span>
          </div>
          <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                background: progress >= 100 ? "#22c55e" : progress >= 75 ? "#3b82f6" : progress >= 50 ? "#f59e0b" : "#ef4444",
              }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            {progress >= 100 ? "🏆 Meta atingida!" : `${progress}% concluído — reseta toda segunda-feira`}
          </p>
        </div>
      </div>

      {/* Menu */}
      <div className="space-y-1.5">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.label} onClick={() => handleMenuClick(item.label)}
              className="w-full glass-card p-3.5 flex items-center gap-3 hover:border-primary/20 transition-all active:scale-[0.98]">
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

      {/* Modais */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={closeModal}>
          <div className="glass-card w-full max-w-md rounded-2xl p-6 space-y-5 overflow-y-auto"
            style={{ maxHeight: "calc(100dvh - 48px)" }} onClick={(e) => e.stopPropagation()}>

            {modal === "metas" && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold flex items-center gap-2"><Star size={20} className="text-primary" /> Minhas Metas</h2>
                  <button onClick={closeModal}><X size={20} /></button>
                </div>

                {/* Pontuação alvo */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold">🏆 Pontuação alvo semanal</label>
                  <div className="flex items-center gap-3">
                    <input type="range" min={1000} max={50000} step={500} value={goals.targetScore}
                      onChange={(e) => setGoals((g) => ({ ...g, targetScore: +e.target.value }))} className="flex-1 accent-primary" />
                    <span className="text-sm font-bold text-primary w-20 text-right">{goals.targetScore.toLocaleString("pt-BR")} pts</span>
                  </div>
                </div>

                {/* Progresso semanal detalhado */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold">📊 Progresso esta semana</label>
                  <div className="glass-card p-4 space-y-3 rounded-xl">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Quiz: <span className="text-primary font-bold">{weekScore.quiz} pts</span></span>
                      <span className="text-muted-foreground">TAF: <span className="text-primary font-bold">{weekScore.taf} pts</span></span>
                      <span className="text-muted-foreground">Total: <span className="text-primary font-bold">{totalScore}</span></span>
                    </div>
                    <div className="w-full h-3 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${progress}%`,
                          background: progress >= 100 ? "#22c55e" : progress >= 75 ? "#3b82f6" : progress >= 50 ? "#f59e0b" : "#ef4444",
                        }}
                      />
                    </div>
                    <p className="text-xs text-center font-semibold">
                      {progress >= 100
                        ? "🏆 Meta atingida! Parabéns!"
                        : `${progress}% da meta — faltam ${(goals.targetScore - totalScore).toLocaleString("pt-BR")} pts`}
                    </p>
                  </div>
                </div>

                {/* Área foco */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold">🎯 Área foco</label>
                  <div className="grid grid-cols-3 gap-2">
                    {AREAS.map((a) => (
                      <button key={a} onClick={() => setGoals((g) => ({ ...g, focusArea: a }))}
                        className={`py-2 rounded-xl text-sm font-bold transition-all ${goals.focusArea === a ? "gradient-primary text-primary-foreground glow-primary" : "glass-card text-muted-foreground"}`}>
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
                      <button key={d} onClick={() => toggleDay(i)}
                        className={`w-10 h-10 rounded-xl text-xs font-bold transition-all ${goals.studyDays.includes(i) ? "gradient-primary text-primary-foreground" : "glass-card text-muted-foreground"}`}>
                        {d}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">{goals.studyDays.length} dia{goals.studyDays.length !== 1 ? "s" : ""} por semana</p>
                </div>

                <button onClick={handleSaveGoals} className="w-full gradient-primary text-primary-foreground py-3 rounded-xl font-semibold glow-primary active:scale-95 transition-transform">Salvar Metas</button>
              </>
            )}

            {modal === "aparencia" && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold flex items-center gap-2"><Moon size={20} className="text-primary" /> Aparência</h2>
                  <button onClick={closeModal}><X size={20} /></button>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">🌗 Tema</label>
                  <div className="flex gap-3">
                    {[{ val: "dark", label: "Escuro", Icon: Moon }, { val: "light", label: "Claro", Icon: Sun }].map(({ val, label, Icon }) => (
                      <button key={val} onClick={() => setAppear((a) => ({ ...a, theme: val }))}
                        className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-all ${appear.theme === val ? "gradient-primary text-primary-foreground glow-primary" : "glass-card text-muted-foreground"}`}>
                        <Icon size={16} /> {label} {appear.theme === val && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">🎨 Cor de destaque</label>
                  <div className="grid grid-cols-3 gap-2">
                    {ACCENT_COLORS.map((c) => (
                      <button key={c.value} onClick={() => setAppear((a) => ({ ...a, accent: c.value }))}
                        className={`py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold transition-all glass-card ${appear.accent === c.value ? "border-2 border-white/40" : ""}`}>
                        <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: c.hex }} />
                        {c.label} {appear.accent === c.value && <Check size={12} />}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={handleSaveAppearance} className="w-full gradient-primary text-primary-foreground py-3 rounded-xl font-semibold glow-primary active:scale-95 transition-transform">Aplicar</button>
              </>
            )}

            {modal === "ajuda" && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold flex items-center gap-2"><HelpCircle size={20} className="text-primary" /> Ajuda</h2>
                  <button onClick={closeModal}><X size={20} /></button>
                </div>
                <p className="text-xs text-muted-foreground">Perguntas frequentes sobre o app</p>
                <div className="space-y-2">
                  {FAQ.map((item, i) => (
                    <div key={i} className="glass-card rounded-xl overflow-hidden">
                      <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                        className="w-full p-4 flex items-center justify-between gap-3 text-left">
                        <span className="text-sm font-semibold">{item.q}</span>
                        <ChevronDown size={16} className={`shrink-0 text-muted-foreground transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                      </button>
                      {openFaq === i && <div className="px-4 pb-4"><p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p></div>}
                    </div>
                  ))}
                </div>
                <div className="glass-card p-4 rounded-xl text-center space-y-1">
                  <p className="text-sm font-semibold">Ainda precisa de ajuda?</p>
                  <p className="text-xs text-muted-foreground">Entre em contato: <span className="text-primary font-medium">suporte@apppolicial.com</span></p>
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

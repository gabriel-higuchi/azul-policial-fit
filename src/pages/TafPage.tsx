import { useState, useEffect, useRef, useCallback } from "react";
import {
  Play, Square, RotateCcw, MapPin, Flame, Clock,
  Navigation, AlertCircle, ChevronRight, X, Trophy,
  Dumbbell, Target, TrendingUp, Award, Medal, Crown,
  CheckCircle, Plus, Minus, BarChart2, ChevronDown, ChevronUp,
  Timer, Zap, Wifi, WifiOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { socket, globalCache, setChatUsername } from "@/lib/socket";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Coord { lat: number; lng: number }
type GpsStatus = "idle" | "requesting" | "active" | "denied" | "unavailable";
type Screen = "main" | "result" | "history-detail" | "exercises" | "ranking" | "progress";

interface RunRecord {
  id: string;
  date: Date;
  seconds: number;
  distanceM: number;
  calories: number;
  coords: Coord[];
  pace: string;
  classification: string;
}

interface ExerciseSet {
  id: string;
  exerciseId: string;
  date: Date;
  reps: number;
  seconds?: number;
  notes?: string;
}

interface Exercise {
  id: string;
  name: string;
  icon: string;
  unit: "reps" | "seconds";
  description: string;
  category: "upper" | "lower" | "core" | "cardio";
  targets: { label: string; value: number; color: string }[];
}

// RankingUser vem de @/lib/socket: { name, score, avatar, attempts? }
// Estendemos localmente para incluir categoria TAF
interface TafRankingEntry {
  name: string;
  score: number;
  avatar?: string;
  type: string;   // "Corrida" | nome do exercício
  date: string;
}

// ─── Exercícios TAF ──────────────────────────────────────────────────────────
const EXERCISES: Exercise[] = [
  {
    id: "flexao",
    name: "Flexão de Braço",
    icon: "💪",
    unit: "reps",
    description: "Posição de prancha, desça até o peito quase tocar o chão e suba.",
    category: "upper",
    targets: [
      { label: "Insuficiente", value: 20, color: "text-destructive" },
      { label: "Regular", value: 30, color: "text-accent" },
      { label: "Bom", value: 40, color: "text-primary" },
      { label: "Excelente", value: 50, color: "text-green-400" },
    ],
  },
  {
    id: "abdominal",
    name: "Abdominal",
    icon: "🔥",
    unit: "reps",
    description: "Deite no chão, pés no chão, mãos atrás da cabeça. Suba até os cotovelos tocarem os joelhos.",
    category: "core",
    targets: [
      { label: "Insuficiente", value: 25, color: "text-destructive" },
      { label: "Regular", value: 35, color: "text-accent" },
      { label: "Bom", value: 45, color: "text-primary" },
      { label: "Excelente", value: 60, color: "text-green-400" },
    ],
  },
  {
    id: "barra",
    name: "Barra Fixa",
    icon: "🏋️",
    unit: "reps",
    description: "Pegada supinada ou pronada, braços estendidos. Puxe até o queixo ultrapassar a barra.",
    category: "upper",
    targets: [
      { label: "Insuficiente", value: 5, color: "text-destructive" },
      { label: "Regular", value: 8, color: "text-accent" },
      { label: "Bom", value: 12, color: "text-primary" },
      { label: "Excelente", value: 15, color: "text-green-400" },
    ],
  },
  {
    id: "agachamento",
    name: "Agachamento",
    icon: "🦵",
    unit: "reps",
    description: "Pés afastados na largura dos ombros. Desça até as coxas ficarem paralelas ao chão.",
    category: "lower",
    targets: [
      { label: "Insuficiente", value: 20, color: "text-destructive" },
      { label: "Regular", value: 30, color: "text-accent" },
      { label: "Bom", value: 40, color: "text-primary" },
      { label: "Excelente", value: 50, color: "text-green-400" },
    ],
  },
  {
    id: "prancha",
    name: "Prancha Isométrica",
    icon: "⚡",
    unit: "seconds",
    description: "Apoie nos antebraços e pontas dos pés. Mantenha o corpo reto como uma tábua.",
    category: "core",
    targets: [
      { label: "Insuficiente", value: 30, color: "text-destructive" },
      { label: "Regular", value: 60, color: "text-accent" },
      { label: "Bom", value: 90, color: "text-primary" },
      { label: "Excelente", value: 120, color: "text-green-400" },
    ],
  },
  {
    id: "burpee",
    name: "Burpee",
    icon: "🌀",
    unit: "reps",
    description: "Em pé, agache, mãos no chão, pule para prancha, flexão, volta, salto com braços para cima.",
    category: "cardio",
    targets: [
      { label: "Insuficiente", value: 10, color: "text-destructive" },
      { label: "Regular", value: 15, color: "text-accent" },
      { label: "Bom", value: 20, color: "text-primary" },
      { label: "Excelente", value: 25, color: "text-green-400" },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function haversine(a: Coord, b: Coord): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
    Math.cos((b.lat * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function totalDistance(coords: Coord[]): number {
  let d = 0;
  for (let i = 1; i < coords.length; i++) d += haversine(coords[i - 1], coords[i]);
  return d;
}

const formatTime = (s: number) => {
  const mins = Math.floor(s / 60).toString().padStart(2, "0");
  const secs = (s % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
};

function classifyRun(m: number) {
  if (m >= 2600) return { label: "Excelente 🏆", color: "text-green-400", score: 100 };
  if (m >= 2200) return { label: "Bom 👍", color: "text-primary", score: 75 };
  if (m >= 1800) return { label: "Regular ⚡", color: "text-accent", score: 50 };
  if (m > 0) return { label: "Insuficiente", color: "text-destructive", score: 25 };
  return { label: "—", color: "text-muted-foreground", score: 0 };
}

function classifyExercise(exercise: Exercise, value: number) {
  const targets = [...exercise.targets].reverse();
  for (const t of targets) {
    if (value >= t.value) return t;
  }
  return { label: "Abaixo do mínimo", value: 0, color: "text-muted-foreground" };
}

const INCENTIVES = [
  "Cada passo conta! Continue treinando e você vai longe. 💪",
  "A consistência é o segredo dos campeões. Não pare agora! 🔥",
  "Seu esforço de hoje é sua aprovação de amanhã. Vai em frente! 🎯",
  "Policial de verdade não desiste! Você está no caminho certo. 🚔",
  "Treino duro, prova fácil! Continue assim! 🏃",
  "Cada treino te aproxima da aprovação. Orgulhe-se de você! ⭐",
];

// ─── Local Storage ────────────────────────────────────────────────────────────
const HISTORY_KEY = "taf_history";
const SETS_KEY = "taf_exercise_sets";
// Ranking TAF local — guarda melhor resultado por usuário+tipo para envio via socket
const TAF_RANKING_KEY = "taf_local_ranking";

function loadHistory(): RunRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as any[];
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return data
      .filter((r) => new Date(r.date).getTime() > cutoff)
      .map((r) => ({ ...r, date: new Date(r.date) }));
  } catch { return []; }
}

function loadExerciseSets(): ExerciseSet[] {
  try {
    const raw = localStorage.getItem(SETS_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as any[];
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return data
      .filter((r) => new Date(r.date).getTime() > cutoff)
      .map((r) => ({ ...r, date: new Date(r.date) }));
  } catch { return []; }
}

function loadLocalTafRanking(): TafRankingEntry[] {
  try {
    const raw = localStorage.getItem(TAF_RANKING_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

function saveData(key: string, data: any[]) {
  localStorage.setItem(key, JSON.stringify(data));
}

function buildSvgPath(coords: Coord[], w: number, h: number): string {
  if (coords.length < 2) return "";
  const lats = coords.map((c) => c.lat);
  const lngs = coords.map((c) => c.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const rangeX = maxLng - minLng || 0.0001;
  const rangeY = maxLat - minLat || 0.0001;
  const pad = 12;
  const toX = (lng: number) => pad + ((lng - minLng) / rangeX) * (w - pad * 2);
  const toY = (lat: number) => h - pad - ((lat - minLat) / rangeY) * (h - pad * 2);
  return coords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${toX(c.lng).toFixed(1)} ${toY(c.lat).toFixed(1)}`)
    .join(" ");
}

// ─── Sub-componente: Abas de navegação ───────────────────────────────────────
const NAV_TABS = [
  { id: "main", label: "Corrida", icon: "🏃" },
  { id: "exercises", label: "Exercícios", icon: "💪" },
  { id: "progress", label: "Progresso", icon: "📈" },
  { id: "ranking", label: "Ranking", icon: "🏆" },
] as const;

// ─── Componente principal ─────────────────────────────────────────────────────
const TafPage = () => {
  const { session } = useAuth();
  const username =
    session?.user?.user_metadata?.display_name ||
    session?.user?.email?.split("@")[0] ||
    "Anônimo";

  // ── Estado geral
  const [screen, setScreen] = useState<Screen>("main");
  const [activeTab, setActiveTab] = useState<"main" | "exercises" | "progress" | "ranking">("main");
  const [isRunning, setIsRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [saved, setSaved] = useState(false);
  const [coords, setCoords] = useState<Coord[]>([]);
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("idle");
  const [speed, setSpeed] = useState(0);
  const [mapReady, setMapReady] = useState(false);
  const [lastRun, setLastRun] = useState<RunRecord | null>(null);
  const [history, setHistory] = useState<RunRecord[]>(loadHistory);
  const [selectedRun, setSelectedRun] = useState<RunRecord | null>(null);
  const [incentive] = useState(() => INCENTIVES[Math.floor(Math.random() * INCENTIVES.length)]);

  // ── Exercícios
  const [exerciseSets, setExerciseSets] = useState<ExerciseSet[]>(loadExerciseSets);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [currentReps, setCurrentReps] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);

  // ── Ranking
  // globalCache.ranking é o ranking global (quiz/comunidade) — usamos para exibir ranking TAF separado
  const [tafRanking, setTafRanking] = useState<TafRankingEntry[]>([]);
  const [connected, setConnected] = useState(socket.connected);

  const syncFromCache = useCallback(() => {
    // Sempre usa o globalCache — ignora localStorage
    setTafRanking([...globalCache.tafRanking]);
  }, []);

  // ── Sincroniza ranking global do socket — escuta evento "taf_ranking"
useEffect(() => {
  globalCache.listeners.add(syncFromCache);

  const onConnect = () => {
    setConnected(true);
    socket.emit("get_taf_ranking");
  };
  const onDisconnect = () => setConnected(false);
  socket.on("connect", onConnect);
  socket.on("disconnect", onDisconnect);

  if (socket.connected) socket.emit("get_taf_ranking");

  // Limpa localStorage desatualizado e aguarda servidor
  localStorage.removeItem(TAF_RANKING_KEY);
  syncFromCache();

  return () => {
    globalCache.listeners.delete(syncFromCache);
    socket.off("connect", onConnect);
    socket.off("disconnect", onDisconnect);
  };
}, [syncFromCache]);

  // ── Refs
  const runTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const exerciseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchRef = useRef<number | null>(null);
  const mapRef = useRef<any>(null);
  const mapDivRef = useRef<HTMLDivElement>(null);
  const detailMapRef = useRef<any>(null);
  const detailMapDivRef = useRef<HTMLDivElement>(null);
  const polylineRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);

  const distanceM = totalDistance(coords);
  const distanceKm = (distanceM / 1000).toFixed(2);
  const calories = Math.round(distanceM * 0.072);
  const pace = distanceM > 50 ? ((seconds / 60) / (distanceM / 1000)).toFixed(1) : "—";

  // ── Leaflet
  useEffect(() => {
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css"; link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    if ((window as any).L) { leafletRef.current = (window as any).L; setMapReady(true); return; }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => { leafletRef.current = (window as any).L; setMapReady(true); };
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!mapReady || !mapDivRef.current || mapRef.current) return;
    const L = leafletRef.current;
    mapRef.current = L.map(mapDivRef.current, { zoomControl: true, attributionControl: false })
      .setView([-15.7801, -47.9292], 16);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 19 })
      .addTo(mapRef.current);
    polylineRef.current = L.polyline([], { color: "#3b82f6", weight: 5, opacity: 0.9, lineCap: "round", lineJoin: "round" })
      .addTo(mapRef.current);
    const pulseIcon = L.divIcon({
      className: "",
      html: `<div style="position:relative;width:20px;height:20px">
        <div style="position:absolute;inset:0;border-radius:50%;background:#3b82f6;opacity:0.3;animation:pulse-dot 1.5s ease-in-out infinite"></div>
        <div style="position:absolute;inset:4px;border-radius:50%;background:#3b82f6;border:2px solid white"></div>
      </div>`,
      iconSize: [20, 20], iconAnchor: [10, 10],
    });
    markerRef.current = L.marker([0, 0], { icon: pulseIcon });
    if (!document.getElementById("pulse-style")) {
      const style = document.createElement("style");
      style.id = "pulse-style";
      style.textContent = `@keyframes pulse-dot { 0%,100%{transform:scale(1);opacity:.3} 50%{transform:scale(2);opacity:0} }`;
      document.head.appendChild(style);
    }
  }, [mapReady]);

  useEffect(() => {
    if (!mapRef.current || !polylineRef.current || coords.length === 0) return;
    const last = coords[coords.length - 1];
    polylineRef.current.setLatLngs(coords.map((c) => [c.lat, c.lng]));
    if (!mapRef.current.hasLayer(markerRef.current)) markerRef.current.addTo(mapRef.current);
    markerRef.current.setLatLng([last.lat, last.lng]);
    mapRef.current.panTo([last.lat, last.lng], { animate: true, duration: 1 });
  }, [coords]);

  // ── Mapa detalhe
  useEffect(() => {
    if (screen !== "history-detail" || !selectedRun || !mapReady || !detailMapDivRef.current) return;
    if (detailMapRef.current) { detailMapRef.current.remove(); detailMapRef.current = null; }
    setTimeout(() => {
      if (!detailMapDivRef.current) return;
      const L = leafletRef.current;
      const run = selectedRun;
      const map = L.map(detailMapDivRef.current, { zoomControl: true, attributionControl: false });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(map);
      if (run.coords.length >= 2) {
        const latlngs = run.coords.map((c: Coord) => [c.lat, c.lng]);
        const poly = L.polyline(latlngs, { color: "#3b82f6", weight: 5, opacity: 0.9, lineCap: "round" }).addTo(map);
        L.circleMarker(latlngs[0], { radius: 7, fillColor: "#22c55e", color: "white", weight: 2, fillOpacity: 1 }).addTo(map);
        L.circleMarker(latlngs[latlngs.length - 1], { radius: 7, fillColor: "#ef4444", color: "white", weight: 2, fillOpacity: 1 }).addTo(map);
        map.fitBounds(poly.getBounds(), { padding: [20, 20] });
      } else {
        map.setView([-15.7801, -47.9292], 14);
      }
      detailMapRef.current = map;
    }, 100);
  }, [screen, selectedRun, mapReady]);

  // ── GPS
  const startGps = useCallback(() => {
    if (!navigator.geolocation) { setGpsStatus("unavailable"); return; }
    setGpsStatus("requesting");
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsStatus("active");
        const newCoord: Coord = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (pos.coords.accuracy > 30) return;
        setSpeed(pos.coords.speed ?? 0);
        setCoords((prev) => {
          if (prev.length > 0 && haversine(prev[prev.length - 1], newCoord) < 3) return prev;
          return [...prev, newCoord];
        });
      },
      (err) => { setGpsStatus(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"); },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
  }, []);

  const stopGps = useCallback(() => {
    if (watchRef.current !== null) { navigator.geolocation.clearWatch(watchRef.current); watchRef.current = null; }
    setGpsStatus("idle"); setSpeed(0);
  }, []);

  // ── Controles corrida
  const startTimer = () => {
    setSaved(false); setIsRunning(true); startGps();
    runTimerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  const stopTimer = async () => {
    setIsRunning(false);
    if (runTimerRef.current) clearInterval(runTimerRef.current);
    stopGps();
    await finishRun();
  };

  const resetTimer = () => {
    setIsRunning(false);
    if (runTimerRef.current) clearInterval(runTimerRef.current);
    stopGps();
    setSeconds(0); setCoords([]); setSaved(false);
    if (polylineRef.current) polylineRef.current.setLatLngs([]);
    if (markerRef.current && mapRef.current?.hasLayer(markerRef.current))
      mapRef.current.removeLayer(markerRef.current);
  };

  useEffect(() => () => {
    if (runTimerRef.current) clearInterval(runTimerRef.current);
    if (exerciseTimerRef.current) clearInterval(exerciseTimerRef.current);
    stopGps();
  }, [stopGps]);

  // ── Finaliza corrida
  const finishRun = async () => {
    if (seconds < 5) return;
    setSaved(true);
    const metros = Math.round(distanceM) || Math.round(seconds * 3.33);
    const duracao = Math.max(1, Math.round(seconds / 60));
    const cl = classifyRun(metros);
    const paceVal = metros > 50 ? ((seconds / 60) / (metros / 1000)).toFixed(1) : "—";

    const record: RunRecord = {
      id: Date.now().toString(),
      date: new Date(),
      seconds,
      distanceM: metros,
      calories: Math.round(metros * 0.072),
      coords: [...coords],
      pace: paceVal,
      classification: cl.label,
    };

    const newHistory = [record, ...history];
    setHistory(newHistory);
    saveData(HISTORY_KEY, newHistory);
    setLastRun(record);

    // Envia para o ranking global via socket
    emitTafRanking({
      name: username,
      score: metros,
      type: "Corrida",
      date: new Date().toLocaleDateString("pt-BR"),
    });

    if (session?.user) {
      await supabase.from("user_stats").insert({
        user_id: session.user.id, type: "taf",
        score: metros, total: 0, duracao, categoria: "Corrida",
      });
    }

    setScreen("result");
  };

  // ── Controles exercício
  const startExerciseTimer = () => {
    setIsTimerRunning(true);
    setTimerSeconds(0);
    exerciseTimerRef.current = setInterval(() => setTimerSeconds((s) => s + 1), 1000);
  };

  const stopExerciseTimer = () => {
    setIsTimerRunning(false);
    if (exerciseTimerRef.current) clearInterval(exerciseTimerRef.current);
    setCurrentReps(timerSeconds);
  };

  const saveExerciseSet = () => {
    if (!selectedExercise) return;
    const value = selectedExercise.unit === "seconds" ? timerSeconds : currentReps;
    if (value <= 0) return;

    const set: ExerciseSet = {
      id: Date.now().toString(),
      exerciseId: selectedExercise.id,
      date: new Date(),
      reps: value,
    };

    const newSets = [set, ...exerciseSets];
    setExerciseSets(newSets);
    saveData(SETS_KEY, newSets);

    // Envia para o ranking global via socket
    emitTafRanking({
      name: username,
      score: value,
      type: selectedExercise.name,
      date: new Date().toLocaleDateString("pt-BR"),
    });

    setCurrentReps(0);
    setTimerSeconds(0);
    setIsTimerRunning(false);
    setSelectedExercise(null);

    toast({ title: "Série registrada! 💪", description: `${value} ${selectedExercise.unit === "seconds" ? "segundos" : "repetições"} de ${selectedExercise.name}` });
  };

  // ── Emite resultado TAF para o servidor (ranking global)
  // O servidor deve escutar "taf_result" e rebroadcast "taf_ranking" para todos
  const emitTafRanking = (entry: TafRankingEntry) => {
    if (socket.connected) {
      socket.emit("taf_result", entry);
    }
  };

  // ── Helpers para progresso
  const getBestForExercise = (exerciseId: string): ExerciseSet | null => {
    const sets = exerciseSets.filter(s => s.exerciseId === exerciseId);
    if (sets.length === 0) return null;
    return sets.reduce((best, s) => s.reps > best.reps ? s : best);
  };

  const getLastForExercise = (exerciseId: string): ExerciseSet | null => {
    const sets = exerciseSets.filter(s => s.exerciseId === exerciseId);
    if (sets.length === 0) return null;
    return sets[0];
  };

  const getRankIcon = (i: number) => {
    if (i === 0) return <Crown size={18} className="text-yellow-400" />;
    if (i === 1) return <Medal size={18} className="text-gray-400" />;
    if (i === 2) return <Award size={18} className="text-amber-600" />;
    return <span className="w-5 h-5 flex items-center justify-center text-xs font-bold text-muted-foreground">{i + 1}</span>;
  };

  // ── Tela RESULTADO ────────────────────────────────────────────────────────
  if (screen === "result" && lastRun) {
    const cl = classifyRun(lastRun.distanceM);
    const svg = buildSvgPath(lastRun.coords, 280, 120);
    return (
      <div className="animate-slide-up space-y-5 pt-2">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Corrida finalizada!</h1>
          <Trophy size={24} className="text-yellow-400" />
        </div>
        <div className="glass-card p-5 border border-primary/20 space-y-1">
          <p className="text-xs text-primary font-semibold uppercase tracking-wider">Mensagem do treinador</p>
          <p className="text-sm leading-relaxed">{incentive}</p>
        </div>
        <div className="glass-card p-5 text-center space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Classificação TAF</p>
          <p className={`text-2xl font-black ${cl.color}`}>{cl.label}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Distância", value: `${(lastRun.distanceM / 1000).toFixed(2)} km` },
            { label: "Tempo", value: formatTime(lastRun.seconds) },
            { label: "Ritmo", value: `${lastRun.pace} min/km` },
            { label: "Calorias", value: `${lastRun.calories} kcal` },
          ].map((s) => (
            <div key={s.label} className="glass-card p-4 text-center">
              <p className="text-lg font-bold text-primary">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
        {lastRun.coords.length >= 2 && (
          <div className="glass-card p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Percurso</p>
            <svg viewBox="0 0 280 120" className="w-full rounded-lg bg-secondary/40" style={{ height: 120 }}>
              <path d={svg} fill="none" stroke="#3b82f6" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
              <path d={svg} fill="none" stroke="#3b82f6" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" opacity={0.15} />
            </svg>
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={() => { resetTimer(); setScreen("main"); setActiveTab("main"); }}
            className="flex-1 glass-card py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
            <RotateCcw size={16} /> Nova corrida
          </button>
          <button onClick={() => { setScreen("main"); setActiveTab("ranking"); }}
            className="flex-1 gradient-primary text-primary-foreground py-3 rounded-xl text-sm font-semibold glow-primary active:scale-95 transition-transform flex items-center justify-center gap-2">
            <Trophy size={16} /> Ver ranking
          </button>
        </div>
      </div>
    );
  }

  // ── Tela DETALHE HISTÓRICO ────────────────────────────────────────────────
  if (screen === "history-detail" && selectedRun) {
    const cl = classifyRun(selectedRun.distanceM);
    const dateStr = selectedRun.date.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
    const timeStr = selectedRun.date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return (
      <div className="animate-slide-up space-y-5 pt-2">
        <div className="flex items-center gap-3">
          <button onClick={() => setScreen("main")} className="p-2 glass-card rounded-xl"><X size={18} /></button>
          <div>
            <h1 className="text-lg font-bold">Detalhe da corrida</h1>
            <p className="text-xs text-muted-foreground capitalize">{dateStr} às {timeStr}</p>
          </div>
        </div>
        <div className="glass-card p-4 text-center">
          <p className={`text-xl font-black ${cl.color}`}>{cl.label}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Distância", value: `${(selectedRun.distanceM / 1000).toFixed(2)} km` },
            { label: "Tempo", value: formatTime(selectedRun.seconds) },
            { label: "Ritmo", value: `${selectedRun.pace} min/km` },
            { label: "Calorias", value: `${selectedRun.calories} kcal` },
          ].map((s) => (
            <div key={s.label} className="glass-card p-4 text-center">
              <p className="text-lg font-bold text-primary">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="glass-card overflow-hidden">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 pt-4 pb-2">Trajeto realizado</p>
          <div ref={detailMapDivRef} style={{ width: "100%", height: 280 }} />
          {selectedRun.coords.length < 2 && (
            <p className="text-xs text-muted-foreground text-center py-8">Sem dados de GPS para esta corrida</p>
          )}
        </div>
        {selectedRun.coords.length >= 2 && (
          <div className="flex gap-4 text-xs text-muted-foreground px-1">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Início</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Fim</span>
            <span className="flex items-center gap-1.5"><span className="w-6 h-1 rounded bg-blue-500 inline-block" /> Percurso</span>
          </div>
        )}
      </div>
    );
  }

  // ── TELA EXERCÍCIO SELECIONADO ────────────────────────────────────────────
  if (selectedExercise && activeTab === "exercises") {
    const ex = selectedExercise;
    const value = ex.unit === "seconds" ? timerSeconds : currentReps;
    const classification = classifyExercise(ex, value);
    const best = getBestForExercise(ex.id);
    const recentSets = exerciseSets.filter(s => s.exerciseId === ex.id).slice(0, 5);

    return (
      <div className="animate-slide-up space-y-5 pt-2">
        <div className="flex items-center gap-3">
          <button onClick={() => { setSelectedExercise(null); setCurrentReps(0); setTimerSeconds(0); setIsTimerRunning(false); if (exerciseTimerRef.current) clearInterval(exerciseTimerRef.current); }}
            className="p-2 glass-card rounded-xl"><X size={18} /></button>
          <div>
            <h1 className="text-lg font-bold">{ex.icon} {ex.name}</h1>
            <p className="text-xs text-muted-foreground capitalize">{ex.category === "upper" ? "Membros superiores" : ex.category === "lower" ? "Membros inferiores" : ex.category === "core" ? "Core / Abdômen" : "Cardio"}</p>
          </div>
        </div>

        {/* Dica */}
        <div className="glass-card p-4 border border-primary/15 space-y-1">
          <p className="text-xs text-primary font-semibold uppercase tracking-wider">Como executar</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{ex.description}</p>
        </div>

        {/* Counter / Timer */}
        <div className="glass-card p-6 text-center space-y-4">
          <p className="text-6xl font-black font-mono text-gradient-primary">
            {ex.unit === "seconds" ? formatTime(timerSeconds) : currentReps}
          </p>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            {ex.unit === "seconds" ? "Tempo" : "Repetições"}
          </p>

          {value > 0 && (
            <div className={`text-sm font-bold ${classification.color}`}>
              {classification.label}
            </div>
          )}

          {ex.unit === "reps" ? (
            <div className="flex items-center justify-center gap-6">
              <button onClick={() => setCurrentReps(r => Math.max(0, r - 1))}
                className="w-14 h-14 rounded-full glass-card flex items-center justify-center active:scale-90 transition-transform">
                <Minus size={22} />
              </button>
              <span className="text-3xl font-black w-16 text-center">{currentReps}</span>
              <button onClick={() => setCurrentReps(r => r + 1)}
                className="w-14 h-14 rounded-full gradient-primary glow-primary flex items-center justify-center active:scale-90 transition-transform">
                <Plus size={22} className="text-primary-foreground" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-4">
              {!isTimerRunning ? (
                <button onClick={startExerciseTimer}
                  className="w-20 h-20 rounded-full gradient-primary glow-primary flex items-center justify-center active:scale-90 transition-transform">
                  <Play size={32} className="text-primary-foreground ml-1" />
                </button>
              ) : (
                <button onClick={stopExerciseTimer}
                  className="w-20 h-20 rounded-full bg-destructive flex items-center justify-center active:scale-90 transition-transform">
                  <Square size={28} className="text-destructive-foreground" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Salvar */}
        <button
          onClick={saveExerciseSet}
          disabled={value <= 0}
          className="w-full gradient-primary text-primary-foreground py-4 rounded-xl text-base font-bold glow-primary active:scale-95 transition-transform disabled:opacity-40 flex items-center justify-center gap-2"
        >
          <CheckCircle size={20} /> Registrar série
        </button>

        {/* Metas */}
        <div className="glass-card p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Metas TAF</p>
          <div className="space-y-2">
            {ex.targets.map((t) => (
              <div key={t.label} className={`flex justify-between items-center py-1.5 border-b border-border/30 last:border-0 rounded px-2 ${value >= t.value && value > 0 ? "bg-primary/10" : ""}`}>
                <span className={`text-sm font-semibold ${t.color}`}>{value >= t.value && value > 0 ? "▶ " : ""}{t.label}</span>
                <span className="text-xs text-muted-foreground">{t.value}+ {ex.unit === "seconds" ? "seg" : "reps"}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Histórico recente */}
        {recentSets.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Últimas séries</p>
            {recentSets.map((set, i) => {
              const cl = classifyExercise(ex, set.reps);
              const diffMs = Date.now() - set.date.getTime();
              const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
              const when = diffDays === 0 ? "Hoje" : diffDays === 1 ? "Ontem" : `${diffDays} dias atrás`;
              return (
                <div key={set.id} className="glass-card p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{set.reps} {ex.unit === "seconds" ? "seg" : "reps"}</p>
                    <p className="text-xs text-muted-foreground">{when}</p>
                  </div>
                  <span className={`text-xs font-bold ${cl.color}`}>{cl.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─── Layout com abas ────────────────────────────────────────────────────────
  return (
    <div className="animate-slide-up space-y-5 pt-2">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">Treino TAF</h1>
        <p className="text-xs text-muted-foreground">Teste de Aptidão Física</p>
      </div>

      {/* Abas */}
      <div className="grid grid-cols-4 gap-1.5">
        {NAV_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); if (tab.id !== "main") setScreen("main"); }}
            className={`py-2.5 rounded-xl text-[11px] font-semibold flex flex-col items-center gap-1 transition-all ${
              activeTab === tab.id ? "gradient-primary text-primary-foreground glow-primary" : "glass-card text-muted-foreground"
            }`}
          >
            <span className="text-base leading-none">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── ABA: CORRIDA ──────────────────────────────────────────────────── */}
      {activeTab === "main" && (
        <>
          {/* Timer */}
          <div className="glass-card p-6 text-center space-y-2">
            <p className="text-6xl font-black tracking-tight text-gradient-primary font-mono">{formatTime(seconds)}</p>
            <div className="flex items-center justify-center gap-2 h-5">
              {gpsStatus === "active" && <span className="flex items-center gap-1.5 text-xs text-green-400"><span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />GPS ativo</span>}
              {gpsStatus === "requesting" && <span className="text-xs text-yellow-400">Obtendo GPS...</span>}
              {gpsStatus === "denied" && <span className="flex items-center gap-1 text-xs text-destructive"><AlertCircle size={12} /> GPS negado</span>}
              {gpsStatus === "idle" && <p className="text-sm text-muted-foreground">{seconds > 0 ? (saved ? "Treino salvo ✓" : "Pausado") : "Pronto para iniciar"}</p>}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: MapPin, value: distanceKm, unit: "km", color: "text-primary" },
              { icon: Clock, value: pace, unit: "min/km", color: "text-primary" },
              { icon: Navigation, value: (speed * 3.6).toFixed(1), unit: "km/h", color: "text-primary" },
              { icon: Flame, value: calories, unit: "kcal", color: "text-accent" },
            ].map(({ icon: Icon, value, unit, color }, i) => (
              <div key={i} className="glass-card p-3 text-center">
                <Icon size={16} className={`${color} mx-auto mb-1`} />
                <p className="text-base font-bold">{value}</p>
                <p className="text-[10px] text-muted-foreground">{unit}</p>
              </div>
            ))}
          </div>

          {/* Mapa */}
          <div className="glass-card overflow-hidden" style={{ height: 220 }}>
            <div ref={mapDivRef} style={{ width: "100%", height: "100%" }} />
            {!mapReady && <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Carregando mapa...</div>}
          </div>

          {/* Controles */}
          <div className="flex items-center justify-center gap-4">
            {!isRunning ? (
              <button onClick={startTimer} className="w-20 h-20 rounded-full gradient-primary glow-primary flex items-center justify-center active:scale-90 transition-transform">
                <Play size={32} className="text-primary-foreground ml-1" />
              </button>
            ) : (
              <button onClick={stopTimer} className="w-20 h-20 rounded-full bg-destructive flex items-center justify-center active:scale-90 transition-transform">
                <Square size={28} className="text-destructive-foreground" />
              </button>
            )}
            {seconds > 0 && !isRunning && (
              <button onClick={resetTimer} className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center active:scale-90 transition-transform">
                <RotateCcw size={22} className="text-foreground" />
              </button>
            )}
          </div>

          {/* Histórico */}
          {history.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Histórico — últimos 7 dias</h2>
              <div className="space-y-2">
                {history.map((run) => {
                  const cl = classifyRun(run.distanceM);
                  const dateOnly = new Date(run.date.getFullYear(), run.date.getMonth(), run.date.getDate());
                  const nowOnly = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
                  const diffDays = Math.round((nowOnly.getTime() - dateOnly.getTime()) / (1000 * 60 * 60 * 24));
                  const when = diffDays === 0 ? "Hoje" : diffDays === 1 ? "Ontem" : `${diffDays} dias atrás`;
                  const svg = buildSvgPath(run.coords, 60, 40);
                  return (
                    <button key={run.id} onClick={() => { setSelectedRun(run); setScreen("history-detail"); }}
                      className="w-full glass-card p-3.5 flex items-center gap-3 hover:border-primary/20 transition-all active:scale-[0.98]">
                      <div className="w-14 h-10 rounded-lg bg-secondary/60 overflow-hidden shrink-0 flex items-center justify-center">
                        {svg ? (
                          <svg viewBox="0 0 60 40" className="w-full h-full">
                            <path d={svg} fill="none" stroke="#3b82f6" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : <MapPin size={14} className="text-muted-foreground" />}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-semibold">{(run.distanceM / 1000).toFixed(2)} km — {formatTime(run.seconds)}</p>
                        <p className="text-xs text-muted-foreground">{when}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-xs font-bold ${cl.color}`}>{cl.label}</p>
                        <ChevronRight size={14} className="text-muted-foreground ml-auto mt-0.5" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tabela referência */}
          <div className="glass-card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Referência TAF (12 min)</h3>
            <div className="space-y-2 text-xs">
              {[
                { label: "Excelente", value: "≥ 2.600m", color: "text-green-400" },
                { label: "Bom", value: "2.200 – 2.599m", color: "text-primary" },
                { label: "Regular", value: "1.800 – 2.199m", color: "text-accent" },
                { label: "Insuficiente", value: "< 1.800m", color: "text-destructive" },
              ].map((row) => {
                const inRange =
                  (row.label === "Excelente" && distanceM >= 2600) ||
                  (row.label === "Bom" && distanceM >= 2200 && distanceM < 2600) ||
                  (row.label === "Regular" && distanceM >= 1800 && distanceM < 2200) ||
                  (row.label === "Insuficiente" && distanceM > 0 && distanceM < 1800);
                return (
                  <div key={row.label} className={`flex items-center justify-between py-1.5 border-b border-border/30 last:border-0 rounded px-2 ${inRange ? "bg-primary/10" : ""}`}>
                    <span className={`font-semibold ${row.color}`}>{inRange && "▶ "}{row.label}</span>
                    <span className="text-muted-foreground">{row.value}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── ABA: EXERCÍCIOS ───────────────────────────────────────────────── */}
      {activeTab === "exercises" && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">Registre suas séries e acompanhe sua evolução em cada exercício do TAF.</p>

          {/* Categorias */}
          {(["upper", "lower", "core", "cardio"] as const).map((category) => {
            const categoryExercises = EXERCISES.filter(e => e.category === category);
            const labels: Record<string, string> = { upper: "Membros Superiores", lower: "Membros Inferiores", core: "Core / Abdômen", cardio: "Cardio" };
            return (
              <div key={category} className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{labels[category]}</p>
                {categoryExercises.map((ex) => {
                  const best = getBestForExercise(ex.id);
                  const last = getLastForExercise(ex.id);
                  const cl = best ? classifyExercise(ex, best.reps) : null;

                  return (
                    <button key={ex.id} onClick={() => { setSelectedExercise(ex); setCurrentReps(0); setTimerSeconds(0); }}
                      className="w-full glass-card p-4 flex items-center gap-3 hover:border-primary/20 transition-all active:scale-[0.98] text-left">
                      <div className="w-12 h-12 rounded-xl bg-secondary/60 flex items-center justify-center text-2xl shrink-0">
                        {ex.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{ex.name}</p>
                        {best ? (
                          <p className="text-xs text-muted-foreground">
                            Melhor: {best.reps} {ex.unit === "seconds" ? "seg" : "reps"}
                            {cl && <span className={` ml-1 ${cl.color}`}>— {cl.label}</span>}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">Nenhuma série registrada</p>
                        )}
                      </div>
                      <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* ── ABA: PROGRESSO ────────────────────────────────────────────────── */}
      {activeTab === "progress" && (
        <div className="space-y-4">
          {/* Resumo geral */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Corridas", value: history.length, icon: "🏃" },
              { label: "Séries", value: exerciseSets.length, icon: "💪" },
              { label: "Km total", value: (history.reduce((sum, r) => sum + r.distanceM, 0) / 1000).toFixed(1), icon: "📍" },
            ].map((stat) => (
              <div key={stat.label} className="glass-card p-3 text-center space-y-1">
                <span className="text-xl">{stat.icon}</span>
                <p className="text-lg font-black text-primary">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Progresso por exercício */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Evolução por exercício</p>
            {EXERCISES.map((ex) => {
              const sets = exerciseSets.filter(s => s.exerciseId === ex.id);
              const best = sets.length > 0 ? Math.max(...sets.map(s => s.reps)) : 0;
              const lastTarget = ex.targets[ex.targets.length - 1].value;
              const progress = Math.min(100, (best / lastTarget) * 100);
              const cl = best > 0 ? classifyExercise(ex, best) : null;
              const isExpanded = expandedExercise === ex.id;

              return (
                <div key={ex.id} className="glass-card overflow-hidden">
                  <button
                    onClick={() => setExpandedExercise(isExpanded ? null : ex.id)}
                    className="w-full p-4 flex items-center gap-3"
                  >
                    <span className="text-xl shrink-0">{ex.icon}</span>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold">{ex.name}</p>
                        {cl ? (
                          <span className={`text-xs font-bold ${cl.color}`}>{cl.label}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sem dados</span>
                        )}
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
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {best > 0 ? `Melhor: ${best} ${ex.unit === "seconds" ? "seg" : "reps"}` : "Comece a registrar"}
                        {" "}/ meta: {lastTarget} {ex.unit === "seconds" ? "seg" : "reps"}
                      </p>
                    </div>
                    {isExpanded ? <ChevronUp size={16} className="text-muted-foreground shrink-0" /> : <ChevronDown size={16} className="text-muted-foreground shrink-0" />}
                  </button>

                  {isExpanded && sets.length > 0 && (
                    <div className="border-t border-border/30 px-4 pb-4 pt-3 space-y-2">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Últimas {Math.min(5, sets.length)} séries</p>
                      {sets.slice(0, 5).map((set, i) => {
                        const setCl = classifyExercise(ex, set.reps);
                        const diffMs = Date.now() - set.date.getTime();
                        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                        const when = diffDays === 0 ? "Hoje" : diffDays === 1 ? "Ontem" : `${diffDays}d atrás`;
                        return (
                          <div key={set.id} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground text-xs">{when}</span>
                            <span className="font-semibold">{set.reps} {ex.unit === "seconds" ? "seg" : "reps"}</span>
                            <span className={`text-xs font-bold ${setCl.color}`}>{setCl.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {isExpanded && sets.length === 0 && (
                    <div className="border-t border-border/30 px-4 pb-4 pt-3">
                      <p className="text-xs text-muted-foreground text-center">Nenhuma série registrada ainda.</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Corridas recentes */}
          {history.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Corridas recentes</p>
              {history.slice(0, 5).map((run) => {
                const cl = classifyRun(run.distanceM);
                const diffMs = Date.now() - run.date.getTime();
                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                const when = diffDays === 0 ? "Hoje" : diffDays === 1 ? "Ontem" : `${diffDays}d atrás`;
                return (
                  <div key={run.id} className="glass-card p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{(run.distanceM / 1000).toFixed(2)} km</p>
                      <p className="text-xs text-muted-foreground">{when} · {formatTime(run.seconds)}</p>
                    </div>
                    <span className={`text-xs font-bold ${cl.color}`}>{cl.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ABA: RANKING ──────────────────────────────────────────────────── */}
      {activeTab === "ranking" && (
        <div className="space-y-4">

          {/* Status de conexão */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Ranking semanal — reseta toda segunda-feira.</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (confirm("Resetar ranking e chat agora?")) {
                      socket.emit("force_reset");
                    }
                  }}
                  className="text-xs text-destructive px-2 py-1 glass-card rounded-lg active:scale-95 transition-transform"
                >
                  🔄 Resetar
                </button>
                <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                  connected ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"
                }`}>
                  {connected ? <><Wifi size={12} /> Online</> : <><WifiOff size={12} /> Reconectando...</>}
                </div>
              </div>
            </div>

          {/* Ranking por corrida */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              🏃 Corrida (distância)
            </p>
            {(() => {
              const runRanking = tafRanking.filter(r => r.type === "Corrida").sort((a, b) => b.score - a.score);
              if (runRanking.length === 0) {
                return (
                  <div className="glass-card p-6 text-center text-muted-foreground text-sm">
                    {connected ? "Nenhuma corrida registrada ainda. Complete um treino! 🏃" : "Aguardando conexão para carregar..."}
                  </div>
                );
              }
              return runRanking.map((entry, i) => {
                const cl = classifyRun(entry.score);
                const isMe = entry.name === username;
                return (
                  <div key={i} className={`glass-card p-4 flex items-center gap-3 ${i === 0 ? "border border-yellow-400/30" : ""} ${isMe ? "border border-primary/40" : ""}`}>
                    <div className="w-6 flex items-center justify-center shrink-0">{getRankIcon(i)}</div>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${i === 0 ? "gradient-primary text-primary-foreground glow-primary" : "bg-secondary text-foreground"}`}>
                      {entry.avatar || entry.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {entry.name} {isMe && <span className="text-xs text-primary font-normal">(você)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{entry.date}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-primary">{(entry.score / 1000).toFixed(2)} km</p>
                      <p className={`text-xs font-semibold ${cl.color}`}>{cl.label.replace(/[^\w\s]/g, "").trim()}</p>
                    </div>
                  </div>
                );
              });
            })()}
          </div>

          {/* Ranking por exercício */}
          {EXERCISES.map((ex) => {
            const exRanking = tafRanking.filter(r => r.type === ex.name).sort((a, b) => b.score - a.score);
            if (exRanking.length === 0) return null;
            return (
              <div key={ex.id} className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {ex.icon} {ex.name}
                </p>
                {exRanking.map((entry, i) => {
                  const cl = classifyExercise(ex, entry.score);
                  const isMe = entry.name === username;
                  return (
                    <div key={i} className={`glass-card p-4 flex items-center gap-3 ${i === 0 ? "border border-yellow-400/30" : ""} ${isMe ? "border border-primary/40" : ""}`}>
                      <div className="w-6 flex items-center justify-center shrink-0">{getRankIcon(i)}</div>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${i === 0 ? "gradient-primary text-primary-foreground glow-primary" : "bg-secondary text-foreground"}`}>
                        {entry.avatar || entry.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {entry.name} {isMe && <span className="text-xs text-primary font-normal">(você)</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">{entry.date}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-primary">{entry.score} {ex.unit === "seconds" ? "seg" : "reps"}</p>
                        <p className={`text-xs font-semibold ${cl.color}`}>{cl.label}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {tafRanking.length === 0 && (
            <div className="glass-card p-8 text-center text-muted-foreground text-sm space-y-2">
              <Trophy size={32} className="mx-auto text-yellow-400/40" />
              <p>Nenhum resultado ainda.</p>
              <p className="text-xs">Complete um treino ou registre uma série para aparecer no ranking! 🏆</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TafPage;

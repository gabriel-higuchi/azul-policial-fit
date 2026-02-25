import { useState, useEffect, useRef, useCallback } from "react";
import {
  Play, Square, RotateCcw, MapPin, Flame, Clock,
  Navigation, AlertCircle, ChevronRight, X, Trophy,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Coord { lat: number; lng: number }
type GpsStatus = "idle" | "requesting" | "active" | "denied" | "unavailable";
type Screen    = "main" | "result" | "history-detail";

interface RunRecord {
  id:        string;
  date:      Date;
  seconds:   number;
  distanceM: number;
  calories:  number;
  coords:    Coord[];
  pace:      string;
  classification: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function haversine(a: Coord, b: Coord): number {
  const R    = 6371000;
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

function classify(m: number) {
  if (m >= 2600) return { label: "Excelente 🏆", color: "text-green-400" };
  if (m >= 2200) return { label: "Bom 👍",        color: "text-primary"   };
  if (m >= 1800) return { label: "Regular ⚡",    color: "text-accent"    };
  if (m > 0)     return { label: "Insuficiente",  color: "text-destructive"};
  return { label: "—", color: "text-muted-foreground" };
}

const INCENTIVES = [
  "Cada passo conta! Continue treinando e você vai longe. 💪",
  "A consistência é o segredo dos campeões. Não pare agora! 🔥",
  "Seu esforço de hoje é sua aprovação de amanhã. Vai em frente! 🎯",
  "Policial de verdade não desiste! Você está no caminho certo. 🚔",
  "Treino duro, prova fácil! Continue assim! 🏃",
  "Cada treino te aproxima da aprovação. Orgulhe-se de você! ⭐",
  "A disciplina é a ponte entre metas e conquistas. Avante! 🌟",
];

// Histórico local — persiste por 7 dias no localStorage
const HISTORY_KEY = "taf_history";

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

function saveHistory(records: RunRecord[]) {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const filtered = records.filter((r) => r.date.getTime() > cutoff);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
}

// SVG mini-mapa do trajeto (para cards do histórico e detalhe)
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

// ─── Componente principal ─────────────────────────────────────────────────────
const TafPage = () => {
  const { session } = useAuth();

  // ── Estado geral
  const [screen, setScreen]       = useState<Screen>("main");
  const [isRunning, setIsRunning] = useState(false);
  const [seconds, setSeconds]     = useState(0);
  const [saved, setSaved]         = useState(false);
  const [coords, setCoords]       = useState<Coord[]>([]);
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("idle");
  const [speed, setSpeed]         = useState(0);
  const [mapReady, setMapReady]   = useState(false);

  // ── Resultado e histórico
  const [lastRun, setLastRun]             = useState<RunRecord | null>(null);
  const [history, setHistory]             = useState<RunRecord[]>(loadHistory);
  const [selectedRun, setSelectedRun]     = useState<RunRecord | null>(null);
  const [incentive]                       = useState(() =>
    INCENTIVES[Math.floor(Math.random() * INCENTIVES.length)]
  );

  // ── Refs mapa
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchRef    = useRef<number | null>(null);
  const mapRef      = useRef<any>(null);
  const mapDivRef   = useRef<HTMLDivElement>(null);
  const detailMapRef    = useRef<any>(null);
  const detailMapDivRef = useRef<HTMLDivElement>(null);
  const polylineRef = useRef<any>(null);
  const markerRef   = useRef<any>(null);
  const leafletRef  = useRef<any>(null);

  const distanceM  = totalDistance(coords);
  const distanceKm = (distanceM / 1000).toFixed(2);
  const calories   = Math.round(distanceM * 0.072);
  const pace       = distanceM > 50
    ? ((seconds / 60) / (distanceM / 1000)).toFixed(1) : "—";

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

  // ── Mapa do detalhe histórico
  useEffect(() => {
    if (screen !== "history-detail" || !selectedRun || !mapReady || !detailMapDivRef.current) return;
    if (detailMapRef.current) {
      detailMapRef.current.remove();
      detailMapRef.current = null;
    }
    setTimeout(() => {
      if (!detailMapDivRef.current) return;
      const L   = leafletRef.current;
      const run = selectedRun;
      const map = L.map(detailMapDivRef.current, { zoomControl: true, attributionControl: false });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 19 })
        .addTo(map);
      if (run.coords.length >= 2) {
        const latlngs = run.coords.map((c: Coord) => [c.lat, c.lng]);
        const poly = L.polyline(latlngs, { color: "#3b82f6", weight: 5, opacity: 0.9, lineCap: "round" }).addTo(map);
        // Marcador início (verde)
        L.circleMarker(latlngs[0], { radius: 7, fillColor: "#22c55e", color: "white", weight: 2, fillOpacity: 1 }).addTo(map);
        // Marcador fim (vermelho)
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

  // ── Controles
  const startTimer = () => {
    setSaved(false); setIsRunning(true); startGps();
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  const stopTimer = async () => {
    setIsRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
    stopGps();
    await finishRun();
  };

  const resetTimer = () => {
    setIsRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
    stopGps();
    setSeconds(0); setCoords([]); setSaved(false);
    if (polylineRef.current) polylineRef.current.setLatLngs([]);
    if (markerRef.current && mapRef.current?.hasLayer(markerRef.current))
      mapRef.current.removeLayer(markerRef.current);
  };

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); stopGps(); }, [stopGps]);

  // ── Finaliza corrida
  const finishRun = async () => {
    if (seconds < 5) return;
    setSaved(true);
    const metros  = Math.round(distanceM) || Math.round(seconds * 3.33);
    const duracao = Math.round(seconds / 60);
    const cl      = classify(metros);
    const paceVal = metros > 50 ? ((seconds / 60) / (metros / 1000)).toFixed(1) : "—";

    const record: RunRecord = {
      id:             Date.now().toString(),
      date:           new Date(),
      seconds,
      distanceM:      metros,
      calories:       Math.round(metros * 0.072),
      coords:         [...coords],
      pace:           paceVal,
      classification: cl.label,
    };

    // Salva no histórico local
    const newHistory = [record, ...history];
    setHistory(newHistory);
    saveHistory(newHistory);
    setLastRun(record);

    // Salva no Supabase
    if (session?.user) {
      await supabase.from("user_stats").insert({
        user_id: session.user.id, type: "taf",
        score: metros, total: 0, duracao, categoria: "Corrida",
      });
    }

    setScreen("result");
  };

  // ── Tela: RESULTADO ────────────────────────────────────────────────────────
  if (screen === "result" && lastRun) {
    const cl  = classify(lastRun.distanceM);
    const svg = buildSvgPath(lastRun.coords, 280, 120);

    return (
      <div className="animate-slide-up space-y-5 pt-2">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Corrida finalizada!</h1>
          <Trophy size={24} className="text-yellow-400" />
        </div>

        {/* Mensagem de incentivo */}
        <div className="glass-card p-5 border border-primary/20 space-y-1">
          <p className="text-xs text-primary font-semibold uppercase tracking-wider">Mensagem do treinador</p>
          <p className="text-sm leading-relaxed">{incentive}</p>
        </div>

        {/* Classificação */}
        <div className="glass-card p-5 text-center space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Classificação TAF</p>
          <p className={`text-2xl font-black ${cl.color}`}>{cl.label}</p>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Distância",  value: `${(lastRun.distanceM / 1000).toFixed(2)} km` },
            { label: "Tempo",      value: formatTime(lastRun.seconds) },
            { label: "Ritmo",      value: `${lastRun.pace} min/km` },
            { label: "Calorias",   value: `${lastRun.calories} kcal` },
          ].map((s) => (
            <div key={s.label} className="glass-card p-4 text-center">
              <p className="text-lg font-bold text-primary">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Mini-mapa do percurso */}
        {lastRun.coords.length >= 2 && (
          <div className="glass-card p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Percurso</p>
            <svg viewBox="0 0 280 120" className="w-full rounded-lg bg-secondary/40" style={{ height: 120 }}>
              <path d={svg} fill="none" stroke="#3b82f6" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
              <path d={svg} fill="none" stroke="#3b82f6" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" opacity={0.15} />
            </svg>
          </div>
        )}

        {/* Ações */}
        <div className="flex gap-3">
          <button
            onClick={() => { resetTimer(); setScreen("main"); }}
            className="flex-1 glass-card py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
          >
            <RotateCcw size={16} /> Nova corrida
          </button>
          <button
            onClick={() => setScreen("main")}
            className="flex-1 gradient-primary text-primary-foreground py-3 rounded-xl text-sm font-semibold glow-primary active:scale-95 transition-transform"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  // ── Tela: DETALHE DO HISTÓRICO ────────────────────────────────────────────
  if (screen === "history-detail" && selectedRun) {
    const cl = classify(selectedRun.distanceM);
    const dateStr = selectedRun.date.toLocaleDateString("pt-BR", {
      weekday: "long", day: "2-digit", month: "2-digit",
    });
    const timeStr = selectedRun.date.toLocaleTimeString("pt-BR", {
      hour: "2-digit", minute: "2-digit",
    });

    return (
      <div className="animate-slide-up space-y-5 pt-2">
        <div className="flex items-center gap-3">
          <button onClick={() => setScreen("main")} className="p-2 glass-card rounded-xl">
            <X size={18} />
          </button>
          <div>
            <h1 className="text-lg font-bold">Detalhe da corrida</h1>
            <p className="text-xs text-muted-foreground capitalize">{dateStr} às {timeStr}</p>
          </div>
        </div>

        {/* Classificação */}
        <div className="glass-card p-4 text-center">
          <p className={`text-xl font-black ${cl.color}`}>{cl.label}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Distância", value: `${(selectedRun.distanceM / 1000).toFixed(2)} km` },
            { label: "Tempo",     value: formatTime(selectedRun.seconds) },
            { label: "Ritmo",     value: `${selectedRun.pace} min/km` },
            { label: "Calorias",  value: `${selectedRun.calories} kcal` },
          ].map((s) => (
            <div key={s.label} className="glass-card p-4 text-center">
              <p className="text-lg font-bold text-primary">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Mapa com trajeto real */}
        <div className="glass-card overflow-hidden space-y-0">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 pt-4 pb-2">
            Trajeto realizado
          </p>
          <div ref={detailMapDivRef} style={{ width: "100%", height: 280 }} />
          {selectedRun.coords.length < 2 && (
            <p className="text-xs text-muted-foreground text-center py-8">
              Sem dados de GPS para esta corrida
            </p>
          )}
        </div>

        {/* Legenda */}
        {selectedRun.coords.length >= 2 && (
          <div className="flex gap-4 text-xs text-muted-foreground px-1">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Início
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Fim
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-6 h-1 rounded bg-blue-500 inline-block" /> Percurso
            </span>
          </div>
        )}
      </div>
    );
  }

  // ── Tela: PRINCIPAL ────────────────────────────────────────────────────────
  return (
    <div className="animate-slide-up space-y-5 pt-2">
      <div>
        <h1 className="text-xl font-bold">Treino TAF</h1>
        <p className="text-xs text-muted-foreground">Teste de Aptidão Física — Corrida com GPS</p>
      </div>

      {/* Timer */}
      <div className="glass-card p-6 text-center space-y-2">
        <p className="text-6xl font-black tracking-tight text-gradient-primary font-mono">
          {formatTime(seconds)}
        </p>
        <div className="flex items-center justify-center gap-2 h-5">
          {gpsStatus === "active"     && <span className="flex items-center gap-1.5 text-xs text-green-400"><span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />GPS ativo</span>}
          {gpsStatus === "requesting" && <span className="text-xs text-yellow-400">Obtendo GPS...</span>}
          {gpsStatus === "denied"     && <span className="flex items-center gap-1 text-xs text-destructive"><AlertCircle size={12} /> GPS negado</span>}
          {gpsStatus === "idle"       && <p className="text-sm text-muted-foreground">{seconds > 0 ? (saved ? "Treino salvo ✓" : "Pausado") : "Pronto para iniciar"}</p>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { icon: MapPin,     value: distanceKm,               unit: "km",     color: "text-primary" },
          { icon: Clock,      value: pace,                      unit: "min/km", color: "text-primary" },
          { icon: Navigation, value: (speed * 3.6).toFixed(1), unit: "km/h",   color: "text-primary" },
          { icon: Flame,      value: calories,                  unit: "kcal",   color: "text-accent"  },
        ].map(({ icon: Icon, value, unit, color }, i) => (
          <div key={i} className="glass-card p-3 text-center">
            <Icon size={16} className={`${color} mx-auto mb-1`} />
            <p className="text-base font-bold">{value}</p>
            <p className="text-[10px] text-muted-foreground">{unit}</p>
          </div>
        ))}
      </div>

      {/* Mapa */}
      <div className="glass-card overflow-hidden" style={{ height: 240 }}>
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

      {/* Histórico da semana */}
      {history.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
            Histórico — últimos 7 dias
          </h2>
          <div className="space-y-2">
            {history.map((run) => {
              const cl      = classify(run.distanceM);
              const dateOnly = new Date(run.date.getFullYear(), run.date.getMonth(), run.date.getDate());
              const nowOnly  = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
              const diffDays = Math.round((nowOnly.getTime() - dateOnly.getTime()) / (1000 * 60 * 60 * 24));
              const when     = diffDays === 0 ? "Hoje" : diffDays === 1 ? "Ontem" : `${diffDays} dias atrás`;
              const svg      = buildSvgPath(run.coords, 60, 40);

              return (
                <button
                  key={run.id}
                  onClick={() => { setSelectedRun(run); setScreen("history-detail"); }}
                  className="w-full glass-card p-3.5 flex items-center gap-3 hover:border-primary/20 transition-all active:scale-[0.98]"
                >
                  {/* Mini trajeto SVG */}
                  <div className="w-14 h-10 rounded-lg bg-secondary/60 overflow-hidden shrink-0 flex items-center justify-center">
                    {svg ? (
                      <svg viewBox="0 0 60 40" className="w-full h-full">
                        <path d={svg} fill="none" stroke="#3b82f6" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <MapPin size={14} className="text-muted-foreground" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold">
                      {(run.distanceM / 1000).toFixed(2)} km — {formatTime(run.seconds)}
                    </p>
                    <p className="text-xs text-muted-foreground">{when}</p>
                  </div>

                  {/* Classificação */}
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

      {/* Tabela TAF */}
      <div className="glass-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Referência TAF (12 min)</h3>
        <div className="space-y-2 text-xs">
          {[
            { label: "Excelente",    value: "≥ 2.600m",       color: "text-green-400"    },
            { label: "Bom",          value: "2.200 – 2.599m", color: "text-primary"      },
            { label: "Regular",      value: "1.800 – 2.199m", color: "text-accent"       },
            { label: "Insuficiente", value: "< 1.800m",       color: "text-destructive"  },
          ].map((row) => {
            const inRange =
              (row.label === "Excelente"    && distanceM >= 2600) ||
              (row.label === "Bom"          && distanceM >= 2200 && distanceM < 2600) ||
              (row.label === "Regular"      && distanceM >= 1800 && distanceM < 2200) ||
              (row.label === "Insuficiente" && distanceM > 0     && distanceM < 1800);
            return (
              <div key={row.label} className={`flex items-center justify-between py-1.5 border-b border-border/30 last:border-0 rounded px-2 ${inRange ? "bg-primary/10" : ""}`}>
                <span className={`font-semibold ${row.color}`}>{inRange && "▶ "}{row.label}</span>
                <span className="text-muted-foreground">{row.value}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TafPage;

import { useState } from "react";
import { Play, Square, RotateCcw, MapPin, Flame, Clock } from "lucide-react";

const TafPage = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [intervalId, setIntervalId] = useState<ReturnType<typeof setInterval> | null>(null);

  const startTimer = () => {
    setIsRunning(true);
    const id = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    setIntervalId(id);
  };

  const stopTimer = () => {
    setIsRunning(false);
    if (intervalId) clearInterval(intervalId);
    setIntervalId(null);
  };

  const resetTimer = () => {
    stopTimer();
    setSeconds(0);
  };

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Simulated distance based on time (avg pace)
  const distance = (seconds * 3.33 / 60).toFixed(2); // ~3.33 m/s pace
  const calories = Math.round(seconds * 0.15);

  return (
    <div className="animate-slide-up space-y-6 pt-2">
      <div>
        <h1 className="text-xl font-bold">Treino TAF</h1>
        <p className="text-xs text-muted-foreground">Teste de Aptidão Física - Corrida</p>
      </div>

      {/* Timer Display */}
      <div className="glass-card p-8 text-center space-y-2">
        <p className="text-6xl font-black tracking-tight text-gradient-primary font-mono">
          {formatTime(seconds)}
        </p>
        <p className="text-sm text-muted-foreground">
          {isRunning ? "Em andamento..." : seconds > 0 ? "Pausado" : "Pronto para iniciar"}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card p-4 text-center">
          <MapPin size={18} className="text-primary mx-auto mb-1" />
          <p className="text-lg font-bold">{distance}</p>
          <p className="text-[10px] text-muted-foreground">km</p>
        </div>
        <div className="glass-card p-4 text-center">
          <Clock size={18} className="text-primary mx-auto mb-1" />
          <p className="text-lg font-bold">{seconds > 0 ? (seconds / 60 / parseFloat(distance || "1")).toFixed(1) : "0.0"}</p>
          <p className="text-[10px] text-muted-foreground">min/km</p>
        </div>
        <div className="glass-card p-4 text-center">
          <Flame size={18} className="text-accent mx-auto mb-1" />
          <p className="text-lg font-bold">{calories}</p>
          <p className="text-[10px] text-muted-foreground">kcal</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        {!isRunning ? (
          <button
            onClick={startTimer}
            className="w-20 h-20 rounded-full gradient-primary glow-primary flex items-center justify-center active:scale-90 transition-transform"
          >
            <Play size={32} className="text-primary-foreground ml-1" />
          </button>
        ) : (
          <button
            onClick={stopTimer}
            className="w-20 h-20 rounded-full bg-destructive flex items-center justify-center active:scale-90 transition-transform"
          >
            <Square size={28} className="text-destructive-foreground" />
          </button>
        )}
        {seconds > 0 && !isRunning && (
          <button
            onClick={resetTimer}
            className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center active:scale-90 transition-transform"
          >
            <RotateCcw size={22} className="text-foreground" />
          </button>
        )}
      </div>

      {/* TAF Reference Table */}
      <div className="glass-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Referência TAF (12 min)</h3>
        <div className="space-y-2 text-xs">
          {[
            { label: "Excelente", value: "≥ 2.600m", color: "text-green-400" },
            { label: "Bom", value: "2.200 - 2.599m", color: "text-primary" },
            { label: "Regular", value: "1.800 - 2.199m", color: "text-accent" },
            { label: "Insuficiente", value: "< 1.800m", color: "text-destructive" },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
              <span className={`font-semibold ${row.color}`}>{row.label}</span>
              <span className="text-muted-foreground">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TafPage;

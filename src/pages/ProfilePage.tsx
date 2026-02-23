import { Shield, ChevronRight, Bell, Moon, HelpCircle, LogOut, Star } from "lucide-react";

const menuItems = [
  { icon: Bell, label: "Notificações", desc: "Gerenciar alertas" },
  { icon: Star, label: "Metas", desc: "Definir objetivos" },
  { icon: Moon, label: "Aparência", desc: "Tema escuro" },
  { icon: HelpCircle, label: "Ajuda", desc: "FAQ e suporte" },
  { icon: LogOut, label: "Sair", desc: "Desconectar conta" },
];

const ProfilePage = () => {
  return (
    <div className="animate-slide-up space-y-6 pt-2">
      <h1 className="text-xl font-bold">Perfil</h1>

      {/* Profile Card */}
      <div className="glass-card p-6 flex flex-col items-center gap-4">
        <div className="w-20 h-20 rounded-full gradient-primary glow-primary flex items-center justify-center">
          <Shield size={36} className="text-primary-foreground" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-bold">Cadete</h2>
          <p className="text-sm text-muted-foreground">cadete@email.com</p>
        </div>
        <div className="flex gap-6 pt-2">
          <div className="text-center">
            <p className="text-lg font-bold text-primary">127</p>
            <p className="text-[10px] text-muted-foreground">Questões</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-accent">12</p>
            <p className="text-[10px] text-muted-foreground">Treinos</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold">5°</p>
            <p className="text-[10px] text-muted-foreground">Ranking</p>
          </div>
        </div>
      </div>

      {/* Menu */}
      <div className="space-y-1.5">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
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
    </div>
  );
};

export default ProfilePage;

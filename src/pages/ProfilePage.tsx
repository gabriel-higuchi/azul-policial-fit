import { Shield, ChevronRight, Bell, Moon, HelpCircle, LogOut, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const menuItems = [
  { icon: Bell, label: "Notificações", desc: "Gerenciar alertas" },
  { icon: Star, label: "Metas", desc: "Definir objetivos" },
  { icon: Moon, label: "Aparência", desc: "Tema escuro" },
  { icon: HelpCircle, label: "Ajuda", desc: "FAQ e suporte" },
  { icon: LogOut, label: "Sair", desc: "Desconectar conta" },
];

const ProfilePage = () => {
  const navigate = useNavigate();
  const { session } = useAuth();

  const user = session?.user;
  const displayName = user?.user_metadata?.display_name || "Cadete";
  const email = user?.email || "";

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      toast({
        title: "Erro ao sair",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Você saiu da conta 👋",
    });

    navigate("/auth");
  };

  return (
    <div className="animate-slide-up space-y-6 pt-2">
      <h1 className="text-xl font-bold">Perfil</h1>

      <div className="glass-card p-6 flex flex-col items-center gap-4">
        <div className="w-20 h-20 rounded-full gradient-primary glow-primary flex items-center justify-center">
          <Shield size={36} className="text-primary-foreground" />
        </div>

        <div className="text-center">
          <h2 className="text-lg font-bold">{displayName}</h2>
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isLogout = item.label === "Sair";

          return (
            <button
              key={item.label}
              onClick={isLogout ? handleLogout : undefined}
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
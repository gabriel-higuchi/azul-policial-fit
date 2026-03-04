import { useLocation, useNavigate } from "react-router-dom";
import { Home, BookOpen, Timer, Users, User } from "lucide-react";

const tabs = [
  { path: "/",           label: "Início", icon: Home     },
  { path: "/quiz",       label: "Quiz",   icon: BookOpen },
  { path: "/taf",        label: "TAF",    icon: Timer    },
  { path: "/comunidade", label: "Social", icon: Users    },
  { path: "/perfil",     label: "Perfil", icon: User     },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border/50 safe-area-bottom">
      <div className="flex items-center justify-around px-2 py-2 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          const Icon = tab.icon;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 min-w-[56px] ${
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all duration-200 ${isActive ? "gradient-primary glow-primary" : ""}`}>
                <Icon size={20} className={isActive ? "text-primary-foreground" : ""} />
              </div>
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;

import { useState } from "react";
import { Shield, Mail, Lock, User, ArrowRight } from "lucide-react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

const AuthPage = () => {
  const { session, loading: authLoading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 rounded-full gradient-primary animate-pulse" />
      </div>
    );
  }

  if (session) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: "Bem-vindo de volta! 💪" });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName || "Cadete" },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast({
          title: "Conta criada!",
          description: "Verifique seu email para confirmar o cadastro.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8 animate-slide-up">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-2xl gradient-primary glow-primary flex items-center justify-center">
            <Shield size={40} className="text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold">Preparação Policial</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isLogin ? "Entre na sua conta" : "Crie sua conta"}
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="glass-card p-3 flex items-center gap-3">
              <User size={18} className="text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder="Nome de exibição"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="bg-transparent w-full text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          )}

          <div className="glass-card p-3 flex items-center gap-3">
            <Mail size={18} className="text-muted-foreground shrink-0" />
            <input
              type="email"
              placeholder="Email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-transparent w-full text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="glass-card p-3 flex items-center gap-3">
            <Lock size={18} className="text-muted-foreground shrink-0" />
            <input
              type="password"
              placeholder="Senha (mín. 6 caracteres)"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-transparent w-full text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full gradient-primary glow-primary text-primary-foreground font-semibold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
          >
            {loading ? "Aguarde..." : isLogin ? "Entrar" : "Criar conta"}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        {/* Toggle */}
        <p className="text-center text-sm text-muted-foreground">
          {isLogin ? "Não tem conta?" : "Já tem conta?"}{" "}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary font-semibold hover:underline"
          >
            {isLogin ? "Criar conta" : "Entrar"}
          </button>
        </p>
      </div>
    </div>
  );
};

export default AuthPage;

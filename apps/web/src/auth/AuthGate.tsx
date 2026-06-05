import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { Eye, EyeOff, Leaf, Lock, LogIn, UserPlus } from "lucide-react";
import { supabase } from "./supabase";
import { loadTutorialProgress } from "./tutorialProgress";

interface AuthGateProps {
  children: (session: Session, user: User) => ReactNode;
}

type AuthMode = "signin" | "signup";

export function AuthGate({ children }: AuthGateProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [progressReady, setProgressReady] = useState(false);
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setProgressReady(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user.id) return;
    let active = true;
    loadTutorialProgress(session.user.id)
      .catch(() => {
        // Missing progress table should not block login.
      })
      .finally(() => {
        if (active) setProgressReady(true);
      });
    return () => {
      active = false;
    };
  }, [session?.user.id]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName.trim() || email.split("@")[0]
            }
          }
        });
        if (error) throw error;
        setMessage("Conta criada. Entrando...");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao autenticar.");
    } finally {
      setBusy(false);
    }
  };

  if (loading || (session && !progressReady)) {
    return (
      <main className="auth-screen" aria-busy="true">
        <div className="auth-card">
          <Leaf aria-hidden="true" />
          <p>Carregando conta...</p>
        </div>
      </main>
    );
  }

  if (session) {
    return <>{children(session, session.user)}</>;
  }

  return (
    <main className="auth-screen">
      <section className="auth-card" aria-label="Entrar no Oikos Digital">
        <div className="auth-brand">
          <img src="/oikos-logo.png" alt="" />
          <div>
            <span>Oikos Digital</span>
            <strong>{mode === "signin" ? "Entrar" : "Criar conta"}</strong>
          </div>
        </div>

        <form className="auth-form" onSubmit={submit}>
          {mode === "signup" && (
            <label>
              Nome de jogador
              <input
                value={displayName}
                maxLength={24}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Seu nome no jogo"
              />
            </label>
          )}

          <label>
            Email
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="voce@email.com"
            />
          </label>

          <label>
            Senha
            <span className="auth-password-field">
              <input
                required
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimo 6 caracteres"
              />
              <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label="Mostrar senha">
                {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </button>
            </span>
          </label>

          {message && <p className="auth-message">{message}</p>}

          <button type="submit" className="auth-submit" disabled={busy}>
            {mode === "signin" ? <LogIn aria-hidden="true" /> : <UserPlus aria-hidden="true" />}
            {busy ? "Aguarde..." : mode === "signin" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <button
          type="button"
          className="auth-mode-toggle"
          onClick={() => {
            setMode((current) => (current === "signin" ? "signup" : "signin"));
            setMessage(null);
          }}
        >
          <Lock aria-hidden="true" />
          {mode === "signin" ? "Ainda nao tenho conta" : "Ja tenho conta"}
        </button>
      </section>
    </main>
  );
}

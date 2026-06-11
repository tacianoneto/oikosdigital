import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { Eye, EyeOff, Leaf, Lock, LogIn, Mail, UserPlus } from "lucide-react";
import { supabase } from "./supabase";
import { loadTutorialProgress } from "./tutorialProgress";

interface AuthGateProps {
  children: (session: Session, user: User) => ReactNode;
}

type AuthMode = "signin" | "signup";

function getEmailRedirectTo(): string {
  return window.location.origin;
}

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
  const [resending, setResending] = useState(false);
  const [canResendConfirmation, setCanResendConfirmation] = useState(false);
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
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user.id) {
      setProgressReady(false);
      return;
    }

    let active = true;
    setProgressReady(false);
    Promise.race([
      loadTutorialProgress(session.user.id),
      new Promise<void>((resolve) => window.setTimeout(resolve, 4000))
    ])
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
    setCanResendConfirmation(false);
    try {
      const normalizedEmail = email.trim();
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: getEmailRedirectTo(),
            data: {
              display_name: displayName.trim() || normalizedEmail.split("@")[0]
            }
          }
        });
        if (error) throw error;
        setMessage(
          data.session
            ? "Conta criada. Entrando..."
            : "Conta criada. Confirme seu email ou desative confirmacao no Supabase para entrar agora."
        );
        setCanResendConfirmation(!data.session);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (error) throw error;
      }
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "Falha ao autenticar.";
      setCanResendConfirmation(nextMessage.toLowerCase().includes("email not confirmed"));
      setMessage(
        nextMessage.toLowerCase().includes("email not confirmed")
          ? "Email ainda nao confirmado. Verifique spam/lixo ou reenvie o email."
          : nextMessage
      );
    } finally {
      setBusy(false);
    }
  };

  const resendConfirmation = async () => {
    setResending(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: {
          emailRedirectTo: getEmailRedirectTo()
        }
      });
      if (error) throw error;
      setMessage("Email de confirmacao reenviado. Verifique caixa de entrada e spam.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao reenviar confirmacao.");
    } finally {
      setResending(false);
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
          <img src="/oikos-logo.webp" alt="" />
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

          {canResendConfirmation && (
            <button type="button" className="auth-secondary-action" onClick={resendConfirmation} disabled={resending}>
              <Mail aria-hidden="true" />
              {resending ? "Reenviando..." : "Reenviar email"}
            </button>
          )}

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

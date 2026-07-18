import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { signUpEmail } from "@/lib/auth.functions";
import { supabase } from "@/integrations/supabase/client";
import isaLogo from "@/assets/isa-logo.png.asset.json";
import { Checkbox } from "@/components/ui/checkbox";

const SESSION_ONLY_KEY = "isaportal_session_only";

export function installSessionOnlyCleanup() {
  if (typeof window === "undefined") return () => {};
  if (window.sessionStorage.getItem(SESSION_ONLY_KEY) !== "1") return () => {};
  const clearPersistedSession = () => {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith("sb-") && key.endsWith("-auth-token")) window.localStorage.removeItem(key);
    }
  };
  window.addEventListener("pagehide", clearPersistedSession);
  return () => window.removeEventListener("pagehide", clearPersistedSession);
}

export function AuthPage() {
  const navigate = useNavigate();
  const signUpFn = useServerFn(signUpEmail);
  const inviteToken = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("invite")
    : null;
  const [tab, setTab] = useState<"signin" | "signup">(inviteToken ? "signup" : "signin");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        // The authed layout mounts after this navigation, so it never sees the
        // SIGNED_IN event — hand it the role-landing signal explicitly.
        if (event === "SIGNED_IN") window.sessionStorage.setItem("isa-landing-pending", "1");
        navigate({ to: "/dashboard", replace: true });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const applyRememberChoice = () => {
    if (rememberMe) window.sessionStorage.removeItem(SESSION_ONLY_KEY);
    else window.sessionStorage.setItem(SESSION_ONLY_KEY, "1");
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) toast.error(error.message);
    else applyRememberChoice();
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Server-side signup creates the account pre-confirmed (no confirmation
      // email needed — the portal is approval-gated), then we sign straight in.
      await signUpFn({ data: { email: email.trim(), password, fullName: name } });
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      applyRememberChoice();
      toast.success("Account created · you're in. An admin will approve your access shortly.");
    } catch (err) {
      toast.error(String((err as Error).message ?? err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    applyRememberChoice();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) toast.error(error.message || "Google sign-in failed");
  };

  return (
    <div className="dashboard-dark min-h-screen flex items-center justify-center px-4 relative overflow-hidden">

      <div className="relative w-full max-w-md">
        <div className="flex items-center gap-2 mb-6 justify-center">
          <div className="h-9 w-9 flex items-center justify-center">
            <img src={isaLogo.url} alt="ISA" className="h-7 w-7 object-contain" />
          </div>
          <div>
            <div className="text-xs font-semibold tracking-[0.2em] uppercase text-foreground">ISA Portal</div>
            <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Setting Ops Dashboard</div>
          </div>
        </div>

        <div className="card-surface p-6 space-y-4">
          <div>
            <h1 className="text-lg font-semibold">
              {tab === "signin" ? "Welcome back" : "Join the team"}
            </h1>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mt-0.5">
              {tab === "signin" ? "Sign in to your dashboard" : "Create your portal account"}
            </p>
          </div>

          {inviteToken && tab === "signup" && (
            <div className="rounded-sm border border-primary/25 bg-primary/10 px-3 py-2 text-xs text-primary">
              You've been invited to join the ISA Portal. Create your account below · your roles will be assigned automatically when you sign up with your invited email address.
            </div>
          )}

          <div className="inline-flex w-full rounded-sm border border-border bg-[var(--background)] p-0.5">
            <button
              onClick={() => setTab("signin")}
              className={`flex-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-sm transition ${
                tab === "signin" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              }`}
            >Sign in</button>
            <button
              onClick={() => setTab("signup")}
              className={`flex-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-sm transition ${
                tab === "signup" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              }`}
            >Sign up</button>
          </div>

          {tab === "signin" ? (
            <form onSubmit={handleSignIn} className="space-y-3">
              <Field id="email" label="Email" type="email" value={email} onChange={setEmail} />
              <Field id="password" label="Password" type="password" value={password} onChange={setPassword} />
              <label className="flex items-center gap-2 text-[11px] text-muted-foreground select-none">
                <Checkbox
                  checked={rememberMe}
                  onCheckedChange={(v) => setRememberMe(v === true)}
                  className="h-3.5 w-3.5"
                />
                Remember me on this device
              </label>
              <button
                type="submit"
                disabled={loading}
                className="w-full text-[12px] font-semibold px-3 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.99] motion-safe:transition-[background-color,transform] disabled:opacity-40"
              >{loading ? "Signing in…" : "Sign in →"}</button>
              <button
                type="button"
                onClick={async () => {
                  if (!email.trim()) return toast.error("Type your email above first");
                  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                    redirectTo: `${window.location.origin}/profile`,
                  });
                  if (error) return toast.error(error.message);
                  toast.success("Reset link sent · check your inbox");
                }}
                className="w-full text-[11px] text-muted-foreground hover:text-foreground motion-safe:transition-colors"
              >Forgot password?</button>
            </form>
          ) : (
            <form onSubmit={handleSignUp} className="space-y-3">
              <Field id="name" label="Full name" value={name} onChange={setName} />
              <Field id="email2" label="Email" type="email" value={email} onChange={setEmail} />
              <Field id="password2" label="Password" type="password" value={password} onChange={setPassword} minLength={6} />
              <label className="flex items-center gap-2 text-[11px] text-muted-foreground select-none">
                <Checkbox
                  checked={rememberMe}
                  onCheckedChange={(v) => setRememberMe(v === true)}
                  className="h-3.5 w-3.5"
                />
                Remember me on this device
              </label>
              <button
                type="submit"
                disabled={loading}
                className="w-full text-[12px] font-semibold px-3 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.99] motion-safe:transition-[background-color,transform] disabled:opacity-40"
              >{loading ? "Creating…" : "Create account →"}</button>
            </form>
          )}

          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center">
              <span className="bg-card px-2 text-[10px] uppercase tracking-wider text-muted-foreground">Or</span>
            </div>
          </div>

          <button
            onClick={handleGoogle}
            className="w-full inline-flex items-center justify-center gap-2 text-[12px] font-medium px-3 py-2 rounded-sm border border-border bg-[var(--background)] text-foreground hover:border-primary/25"
          >
            <GoogleIcon /> Continue with Google
          </button>
        </div>

        <p className="text-[10px] text-muted-foreground text-center mt-4 uppercase tracking-wider">
          ISA Portal · <Link to="/" className="underline hover:text-foreground">Home</Link>
        </p>
      </div>
    </div>
  );
}

function Field({
  id, label, value, onChange, type = "text", minLength,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  type?: string; minLength?: number;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        required
        minLength={minLength}
        className="w-full bg-[var(--background)] border border-border rounded-sm px-3 py-2 text-sm outline-none focus:border-primary/25"
      />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2.5 24 .5 14.8.5 6.9 5.8 3.2 13.4l7.8 6.1C12.8 13.9 17.9 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.7c-.5 3-2.2 5.6-4.7 7.3l7.5 5.8c4.4-4.1 6.9-10.1 6.9-17.4z"/>
      <path fill="#FBBC05" d="M11 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.8-6.1C1.5 16.6.5 20.2.5 24s1 7.4 2.7 10.7l7.8-6.1z"/>
      <path fill="#34A853" d="M24 47.5c6.2 0 11.4-2 15.2-5.5l-7.5-5.8c-2.1 1.4-4.8 2.3-7.7 2.3-6.1 0-11.2-4.4-13-10.1l-7.8 6.1C6.9 42.2 14.8 47.5 24 47.5z"/>
    </svg>
  );
}

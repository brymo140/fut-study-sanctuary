import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { AuthBack } from "@/components/AuthBack";
import { PasswordInput } from "@/components/PasswordInput";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isHardcodedAdminEmail, useAuth } from "@/contexts/AuthContext";
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

const REMEMBER_KEY = "hv_remember_me";

const Login = () => {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Default to whatever was last chosen (default true)
    const stored = localStorage.getItem(REMEMBER_KEY);
    if (stored !== null) setRemember(stored === "1");
  }, []);

  useEffect(() => {
    if (!authLoading && session) navigate("/", { replace: true });
  }, [authLoading, session, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    setLoading(false);
    if (error) {
      const msg = (error.message || "").toLowerCase();
      const code = (error as any).code || "";
      if (msg.includes("email not confirmed") || code === "email_not_confirmed") {
        toast.error("Email not confirmed yet. Check your inbox.");
      } else if (msg.includes("invalid") || code === "invalid_credentials") {
        // Try to differentiate Google-only accounts from a wrong password
        try {
          const { data: prof } = await supabase
            .from("profiles")
            .select("email")
            .ilike("email", cleanEmail)
            .maybeSingle();
          if (!prof) {
            toast.error("No account found for this email. Please sign up first.");
          } else {
            toast.error(
              "Wrong password — or this account uses Google Sign In. Try the Google button below."
            );
          }
        } catch {
          toast.error("Wrong email or password");
        }
      } else {
        toast.error(error.message || "Could not sign in");
      }
      return;
    }
    if (data.session) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_banned")
        .eq("id", data.session.user.id)
        .maybeSingle();
      if (profile?.is_banned && !isHardcodedAdminEmail(data.session.user.email)) {
        await supabase.auth.signOut();
        toast.error("Your account has been suspended. Contact support.");
        setLoading(false);
        return;
      }
      navigate("/", { replace: true });
    }
  };

  const google = async () => {
    try {
      localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
      if (Capacitor.isNativePlatform()) {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            skipBrowserRedirect: true,
            redirectTo: 'com.highvault.futminna://auth/callback'
          }
        });
        if (error) throw error;
        if (data?.url) {
          await Browser.open({ url: data.url });
        }
      } else {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/auth/callback` 
          }
        });
        if (error) throw error;
      }
    } catch (e: any) {
      toast.error(e.message || 'Google sign in failed');
    }
  };

  return (
    <div className="min-h-screen">
      <div className="app-shell px-6 py-8">
        <AuthBack to="/welcome" />
        <div className="flex justify-center mb-6">
          <Logo size="md" />
        </div>

        <h1 className="text-2xl font-bold mb-1">Welcome back</h1>
        <p className="text-sm text-muted-foreground mb-8">Sign in to continue your studies</p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email or matric number</label>
            <input
              type="text" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary"
              placeholder="you@futminna.edu.ng"
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-medium text-muted-foreground">Password</label>
              <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
            </div>
            <PasswordInput
              required value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none py-1">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-border bg-surface accent-primary cursor-pointer"
            />
            <span className="text-xs text-muted-foreground">Remember me on this device</span>
          </label>

          <Button type="submit" disabled={loading} size="lg" className="w-full bg-gradient-button border border-primary/40 text-primary h-12 rounded-xl font-semibold mt-2">
            {loading ? "Signing in…" : "Login"}
          </Button>
        </form>

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <Button onClick={google} variant="outline" size="lg" className="w-full h-12 rounded-xl bg-surface hover:bg-surface-elevated border-border">
          <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
            <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
            <path fill="#fbbc04" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.83z"/>
            <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
          </svg>
          Continue with Google
        </Button>

        <p className="text-center text-sm text-muted-foreground mt-8">
          New here?{" "}
          <Link to="/signup" className="text-primary font-medium hover:underline">Create an account</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;

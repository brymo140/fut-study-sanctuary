import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [flow, setFlow] = useState<"oauth" | "email">("oauth");

  useEffect(() => {
    const handle = async () => {
      try {
        // Check URL for #access_token (hash) or ?code= (query param)
        const hash = window.location.hash.startsWith("#")
          ? window.location.hash.substring(1)
          : window.location.hash;
        const hashParams = new URLSearchParams(hash);
        const queryParams = new URLSearchParams(window.location.search);

        const access_token = hashParams.get("access_token") || queryParams.get("access_token");
        const refresh_token = hashParams.get("refresh_token") || queryParams.get("refresh_token");
        const code = queryParams.get("code") || hashParams.get("code");

        // If hash tokens found: call supabase.auth.setSession
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (!error) {
            setStatus("success");
            setFlow("email"); // Email verification flow
            return;
          }
        }
        // If code found: call supabase.auth.exchangeCodeForSession
        else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error) {
            setStatus("success");
            setFlow("oauth");
            return;
          }
        }

        // If no tokens found but session exists: redirect to /
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          navigate("/", { replace: true });
          return;
        }

        // If nothing: redirect to /login
        setStatus("error");
      } catch (e) {
        console.error("auth callback failed", e);
        setStatus("error");
      }
    };
    handle();
  }, []);

  useEffect(() => {
    if (status === "success") {
      const timer = setTimeout(() => {
        navigate("/", { replace: true });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="flex flex-col items-center gap-5 text-center max-w-sm">
        <Logo size="md" />
        {status === "loading" && (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Completing sign in…</p>
          </>
        )}
        {status === "success" && (
          <>
            <style>{`
              @keyframes checkmark {
                0% { stroke-dashoffset: 100; }
                100% { stroke-dashoffset: 0; }
              }
              .animated-checkmark {
                stroke-dasharray: 100;
                stroke-dashoffset: 100;
                animation: checkmark 0.8s ease-in-out forwards;
              }
            `}</style>
            <div className="h-20 w-20 rounded-full bg-success flex items-center justify-center animate-in zoom-in duration-500">
              <svg className="h-12 w-12 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path className="animated-checkmark" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mt-4">Email Verified! 🎉</h1>
            <p className="text-sm text-white/80 mt-2">Your HighVault account is ready</p>
            <Button
              onClick={() => navigate("/", { replace: true })}
              size="lg"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 rounded-xl font-semibold mt-6"
            >
              Continue to App →
            </Button>
          </>
        )}
        {status === "error" && (
          <>
            <p className="text-sm text-red-400">We couldn't confirm your session. Please log in.</p>
            <Button
              onClick={() => navigate("/login", { replace: true })}
              className="w-full bg-gradient-button border border-primary/40 text-primary h-12 rounded-xl font-semibold"
            >
              Go to login
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;

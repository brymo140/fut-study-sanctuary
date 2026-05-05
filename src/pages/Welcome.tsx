import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { signInWithGoogleSmart } from "@/lib/nativeAuth";
import { toast } from "sonner";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";

const Welcome = () => {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const { app_tagline } = useSettings();

  useEffect(() => {
    if (!loading && session) navigate("/", { replace: true });
  }, [loading, session, navigate]);

  const handleGoogle = async () => {
    const result = await signInWithGoogleSmart(window.location.origin);
    if ((result as any)?.error) toast.error("Could not start Google sign in");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="app-shell flex-1 flex flex-col px-6 py-12">
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="mb-2">
            <Logo size="lg" />
          </div>
          <p className="text-sm text-muted-foreground mt-2 mb-1 font-medium">
            {app_tagline}
          </p>
          <p className="text-base text-foreground/80 max-w-xs mt-6 leading-relaxed">
            All your course materials, past questions, and learning channels — in one place.
          </p>

          <div className="mt-12 flex h-32 w-32 rounded-3xl bg-gradient-brand items-center justify-center shadow-glow">
            <span className="text-5xl">📚</span>
          </div>
        </div>

        <div className="space-y-3 mt-12">
          <Button asChild size="lg" className="w-full bg-gradient-button hover:bg-gradient-button border border-primary/40 text-primary text-base font-semibold h-12 rounded-xl">
            <Link to="/signup">Create account</Link>
          </Button>
          <Button asChild variant="ghost" size="lg" className="w-full text-foreground/80 hover:text-foreground hover:bg-surface h-12 rounded-xl">
            <Link to="/login">I already have an account → Login</Link>
          </Button>

          <div className="flex items-center gap-3 my-2">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <Button
            onClick={handleGoogle}
            variant="outline"
            size="lg"
            className="w-full h-12 rounded-xl bg-surface hover:bg-surface-elevated border-border"
          >
            <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
              <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
              <path fill="#fbbc04" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.83z"/>
              <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
            </svg>
            Continue with Google
          </Button>

          <p className="text-[11px] text-muted-foreground text-center mt-4 leading-relaxed">
            By continuing you agree to our Terms of Use and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Welcome;

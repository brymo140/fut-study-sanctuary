import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { AuthBack } from "@/components/AuthBack";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase places a recovery session in the URL hash on first load.
    // The auth client will set the session automatically; we just wait for it.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated. You're signed in.");
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen">
      <div className="app-shell px-6 py-8">
        <AuthBack to="/login" />
        <div className="flex justify-center mb-6">
          <Logo size="md" />
        </div>

        <h1 className="text-2xl font-bold mb-1">Set new password</h1>
        <p className="text-sm text-muted-foreground mb-8">
          {ready ? "Choose a strong password you'll remember." : "Verifying your reset link…"}
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">New password</label>
            <input
              type="password" required value={password} disabled={!ready}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary"
              placeholder="At least 6 characters" minLength={6}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Confirm password</label>
            <input
              type="password" required value={confirm} disabled={!ready}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary"
              placeholder="Repeat password"
            />
          </div>
          <Button
            type="submit" disabled={loading || !ready} size="lg"
            className="w-full bg-gradient-button border border-primary/40 text-primary h-12 rounded-xl font-semibold mt-2"
          >
            {loading ? "Saving…" : "Update password"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;

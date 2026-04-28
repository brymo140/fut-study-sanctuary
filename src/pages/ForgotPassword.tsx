import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { AuthBack } from "@/components/AuthBack";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MailCheck } from "lucide-react";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  };

  return (
    <div className="min-h-screen">
      <div className="app-shell px-6 py-8">
        <AuthBack to="/login" />
        <div className="flex justify-center mb-6">
          <Logo size="md" />
        </div>

        {sent ? (
          <div className="text-center mt-10">
            <div className="inline-flex h-16 w-16 rounded-full bg-primary/10 items-center justify-center mb-4">
              <MailCheck className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Check your inbox</h1>
            <p className="text-sm text-muted-foreground mb-8">
              We sent a password reset link to <span className="text-foreground font-medium">{email}</span>. Tap it to set a new password.
            </p>
            <Button asChild variant="outline" className="w-full bg-surface border-border h-12 rounded-xl">
              <Link to="/login">Back to login</Link>
            </Button>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold mb-1">Reset password</h1>
            <p className="text-sm text-muted-foreground mb-8">
              Enter your email and we'll send you a reset link.
            </p>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email</label>
                <input
                  type="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary"
                  placeholder="you@futminna.edu.ng"
                />
              </div>
              <Button
                type="submit" disabled={loading} size="lg"
                className="w-full bg-gradient-button border border-primary/40 text-primary h-12 rounded-xl font-semibold mt-2"
              >
                {loading ? "Sending…" : "Send reset link"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;

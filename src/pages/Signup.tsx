import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { AuthBack } from "@/components/AuthBack";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { PasswordInput } from "@/components/PasswordInput";

const schema = z.object({
  full_name: z.string().trim().min(2, "Name is too short").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
  level: z.enum(["100L", "200L", "300L", "400L", "500L"]),
  department: z.string().trim().min(2, "Enter your department").max(100),
  faculty: z.string().trim().max(100).optional().or(z.literal("")),
  matric_no: z.string().trim().max(50).optional().or(z.literal("")),
});

const Signup = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    level: "100L" as "100L" | "200L" | "300L" | "400L" | "500L",
    department: "",
    faculty: "",
    matric_no: "",
  });
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
  e.preventDefault();
  const parsed = schema.safeParse(form);
  if (!parsed.success) {
    toast.error(parsed.error.errors[0].message);
    return;
  }
  setLoading(true);

  const { data: signupData, error } = await supabase.auth.signUp({
    email: form.email.trim(),
    password: form.password,
    options: {
      emailRedirectTo: `https://highvault-confirm.netlify.app/confirm.html`,
      data: {
        full_name: form.full_name,
        level: form.level,
        department: form.department,
        faculty: form.faculty,
        matric_no: form.matric_no,
      },
    },
  });

  if (error) {
    toast.error(
      error.message.includes("already")
        ? "Email already registered. Please log in instead."
        : error.message
    );
    setLoading(false);
    return;
  }

  const userId = signupData?.user?.id;

  // Save profile details immediately
  if (userId) {
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: userId,
      email: form.email.trim(),
      full_name: form.full_name,
      level: form.level as any,
      department: form.department || null,
      faculty: form.faculty || null,
      matric_no: form.matric_no || null,
      xp: 0,
      streak: 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });

    if (profileError) {
      console.error("Profile save error:", profileError.message);
    }
  }

  setLoading(false);

  // Show success message and navigate to login
  toast.success("Account created! Check your email to confirm then log in.");
  navigate("/login");
};

    const userId = signupData?.user?.id;
    if (!userId) {
      toast.error("Sign up succeeded but no user id was returned.");
      setLoading(false);
      return;
    }

    // Save profile details immediately (after user id is known).
    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: userId,
        email: form.email.trim(),
        full_name: form.full_name,
        level: form.level as any,
        department: form.department || null,
        faculty: form.faculty || null,
        matric_no: form.matric_no || null,
        xp: 0,
        streak: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (profileError) {
      console.error("Profile upsert error:", profileError);
      toast.error(profileError.message || "Could not save your profile");
      setLoading(false);
      return;
    }

    // Verify upsert.
    const { data: verifiedProfile, error: verifyErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (verifyErr) console.error("Profile verification select error:", verifyErr);
    console.log("[Signup] Profile upsert verified:", verifiedProfile);

    // Supabase may auto-confirm users and return a session immediately.
    if (signupData?.session) {
      toast.success("Welcome to HighVault 🎉");
      navigate("/", { replace: true });
    } else {
      toast.success("Check your email to confirm your account.");
      navigate("/login", { replace: true });
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen">
      <div className="app-shell px-6 py-8">
        <AuthBack to="/welcome" />
        <div className="flex justify-center mb-6">
          <Logo size="md" />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-1">Create your account</h1>
        <p className="text-sm text-muted-foreground mb-6">Step 1 of 2 · Tell us about yourself</p>

        <form onSubmit={submit} className="space-y-4">
          <Field label="Full name">
            <input
              type="text"
              required
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="input-base"
              placeholder="Your full name"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input-base"
              placeholder="you@futminna.edu.ng"
            />
          </Field>
          <Field label="Password">
            <PasswordInput
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="input-base pr-11"
              placeholder="At least 6 characters"
              minLength={6}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Level">
              <select
                value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value as typeof form.level })}
                className="input-base"
              >
                <option>100L</option>
                <option>200L</option>
                <option>300L</option>
                <option>400L</option>
                <option>500L</option>
              </select>
            </Field>
            <Field label="Department">
              <input
                type="text"
                required
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                className="input-base"
                placeholder="Comp Sci"
              />
            </Field>
          </div>
          <Field label="Faculty">
            <input
              type="text"
              value={form.faculty}
              onChange={(e) => setForm({ ...form, faculty: e.target.value })}
              className="input-base"
              placeholder="SIPET,SICT,SPS...."
            />
          </Field>
          <Field label="Matric number (optional)">
            <input
              type="text"
              value={form.matric_no}
              onChange={(e) => setForm({ ...form, matric_no: e.target.value })}
              className="input-base"
              placeholder="2020/1/12345CS"
            />
          </Field>

          <Button
            type="submit"
            disabled={loading}
            size="lg"
            className="w-full bg-gradient-button border border-primary/40 text-primary h-12 rounded-xl font-semibold mt-2"
          >
            {loading ? "Creating…" : <><span>Continue</span> <ArrowRight className="h-4 w-4 ml-2" /></>}
          </Button>
        </form>

        <div className="flex justify-center gap-1.5 mt-6">
          <span className="h-1.5 w-6 rounded-full bg-primary" />
          <span className="h-1.5 w-6 rounded-full bg-border" />
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Login
          </Link>
        </p>

        <style>{`
          .input-base {
            width: 100%;
            background-color: hsl(var(--surface));
            border: 1px solid hsl(var(--border));
            border-radius: 0.75rem;
            padding: 0.75rem 1rem;
            font-size: 0.875rem;
            color: hsl(var(--foreground));
            outline: none;
            transition: border-color 0.15s;
          }
          .input-base:focus { border-color: hsl(var(--primary)); }
        `}</style>
      </div>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
    {children}
  </div>
);

export default Signup;

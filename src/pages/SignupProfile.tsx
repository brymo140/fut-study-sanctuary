import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { AuthBack } from "@/components/AuthBack";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Camera, Check } from "lucide-react";

const FACULTIES = [
  "School of Electrical Engineering and Computing (SEEC)",
  "School of Infrastructure, Process Engineering & Tech (SIPET)",
  "School of Physical Sciences (SPS)",
  "School of Life Sciences (SLS)",
  "School of Innovative Tech (SIT)",
  "School of Agriculture & Agricultural Tech (SAAT)",
  "School of Environmental Tech (SET)",
  "School of Entrepreneurship & Mgmt Tech (SEMT)",
  "School of Education & General Studies",
  "Other",
];

const SignupProfile = () => {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const [faculty, setFaculty] = useState(FACULTIES[0]);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      toast.error("Image too large (max 2 MB)");
      return;
    }
    setAvatar(f);
    setPreview(URL.createObjectURL(f));
  };

  const finish = async (skipPhoto = false) => {
    if (!user) {
      navigate("/welcome");
      return;
    }
    setLoading(true);
    let avatar_url: string | null = null;
    if (!skipPhoto && avatar) {
      const path = `${user.id}/${Date.now()}-${avatar.name}`;
      const { data, error } = await supabase.storage.from("avatars").upload(path, avatar);
      if (!error && data) {
        const { data: pub } = supabase.storage.from("avatars").getPublicUrl(data.path);
        avatar_url = pub.publicUrl;
      }
    }

    await supabase.from("profiles").update({
      faculty,
      ...(avatar_url ? { avatar_url } : {}),
    }).eq("id", user.id);

    await refreshProfile();
    sessionStorage.removeItem("signup_partial");
    toast.success("Welcome to StudyHub!");
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen">
      <div className="app-shell px-6 py-8">
        <AuthBack to="/signup" />
        <div className="flex justify-center mb-6">
          <Logo size="md" />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-1">Almost there</h1>
        <p className="text-sm text-muted-foreground mb-8">Step 2 of 2 · A photo and your faculty</p>

        <div className="flex flex-col items-center mb-8">
          <label className="relative h-28 w-28 rounded-full surface-elevated border-2 border-dashed border-border hover:border-primary cursor-pointer flex items-center justify-center overflow-hidden transition-colors">
            {preview ? (
              <img src={preview} alt="Avatar preview" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <Camera className="h-8 w-8 text-muted-foreground" />
            )}
            <input type="file" accept="image/*" onChange={onFile} className="sr-only" />
          </label>
          <p className="text-xs text-muted-foreground mt-3">Tap to add a profile photo</p>
        </div>

        <div className="mb-6">
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Faculty / School</label>
          <select
            value={faculty}
            onChange={(e) => setFaculty(e.target.value)}
            className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary"
          >
            {FACULTIES.map((f) => <option key={f}>{f}</option>)}
          </select>
        </div>

        <Button
          onClick={() => finish(false)}
          disabled={loading}
          size="lg"
          className="w-full bg-gradient-button border border-primary/40 text-primary h-12 rounded-xl font-semibold"
        >
          <Check className="h-4 w-4 mr-2" />
          {loading ? "Setting up…" : "Finish setup"}
        </Button>
        <Button
          onClick={() => finish(true)}
          variant="ghost"
          className="w-full mt-2 text-muted-foreground"
        >
          Skip photo for now
        </Button>

        <div className="flex justify-center gap-1.5 mt-6">
          <span className="h-1.5 w-6 rounded-full bg-primary" />
          <span className="h-1.5 w-6 rounded-full bg-primary" />
        </div>
      </div>
    </div>
  );
};

export default SignupProfile;

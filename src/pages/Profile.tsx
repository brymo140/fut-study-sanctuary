import { useEffect, useState } from "react";
import { useAuth, isHardcodedAdminEmail } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Flame, Award, LogOut, GraduationCap, Building2, BookOpen, Hash, Mail, Shield, ArrowRight, Sun, Moon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const THEME_KEY = "hv_theme";
type Theme = "dark" | "light";

const applyTheme = (theme: Theme) => {
  document.documentElement.classList.toggle("light", theme === "light");
  localStorage.setItem(THEME_KEY, theme);
};

const Profile = () => {
  const { profile, isAdmin, roleLabel, signOut, session } = useAuth();
  const navigate = useNavigate();
  const [freshProfile, setFreshProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [theme, setTheme] = useState<Theme>((localStorage.getItem(THEME_KEY) as Theme) || "dark");
  const showAdminEntry = isAdmin || isHardcodedAdminEmail(session?.user?.email || profile?.email);
  const profileData = freshProfile;

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!session?.user?.id) return;
      setProfileLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();
      if (data) setFreshProfile(data);
      if (error) console.error("Profile fetch error:", error);
      setProfileLoading(false);
    };
    fetchProfile();
    const onFocus = () => fetchProfile();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [session?.user?.id]);

  const initials = (profileData?.full_name || profileData?.email || "U")
    .split(" ")
    .map((s: string) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const xp = profileData?.xp ?? 0;
  const nextMilestone = Math.ceil((xp + 1) / 100) * 100;
  const pct = ((xp % 100) / 100) * 100;

  return (
    <div className="space-y-5">
      {/* Header card */}
      <div className="surface-card p-5 text-center bg-gradient-cover">
        <div className="inline-flex h-20 w-20 rounded-full bg-white/10 backdrop-blur items-center justify-center text-2xl font-bold text-white mb-3 overflow-hidden">
          {profileData?.avatar_url ? (
            <img src={profileData.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : initials}
        </div>
        <h1 className="text-xl font-bold text-white">{profileData?.full_name || "Student"}</h1>
        <p className="text-sm text-white/80 mt-0.5">{profileData?.email || (profileLoading ? "Loading…" : "")}</p>
        <span
          className={`mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
            isAdmin ? "bg-secondary/20 text-secondary" : roleLabel === "Class Rep" ? "bg-primary/20 text-primary" : "bg-white/15 text-white"
          }`}
        >
          <Shield className="h-3 w-3" /> {roleLabel}
        </span>
      </div>

      {/* Admin entry point — always visible to admins */}
      {showAdminEntry && (
        <Button
          onClick={() => navigate("/admin")}
          className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
        >
          Go to Admin Panel <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      )}

      {/* XP + Streak */}
      <div className="grid grid-cols-2 gap-3">
        <div className="surface-card p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Total XP</span>
            <Award className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold gradient-text-brand">{xp}</p>
          <div className="mt-2 h-1.5 rounded-full bg-border overflow-hidden">
            <div className="h-full bg-gradient-brand" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Next: {nextMilestone} XP</p>
        </div>
        <div className="surface-card p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Reading streak</span>
            <Flame className="h-4 w-4 text-warning" />
          </div>
          <p className="text-2xl font-bold text-warning">{profileData?.streak || 0}</p>
          <p className="text-[10px] text-muted-foreground mt-3">Open the app daily to keep it going</p>
        </div>
      </div>

      <Button
        onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        variant="outline"
        className="w-full bg-surface border-border h-12"
      >
        {theme === "dark" ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
        {theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
      </Button>

      {/* Info */}
      <div className="surface-card divide-y divide-border">
        <Row icon={Mail} label="Email" value={profileData?.email || "Not provided"} />
        <Row icon={GraduationCap} label="Level" value={profileData?.level || "Not provided"} />
        <Row icon={Building2} label="Department" value={profileData?.department || "Not provided"} />
        <Row icon={BookOpen} label="Faculty" value={profileData?.faculty || "Not provided"} />
        <Row icon={Hash} label="Matric No" value={profileData?.matric_no || "Not provided"} />
        <Row icon={Shield} label="Account role" value={roleLabel} />
      </div>

      <Button
        onClick={async () => { await signOut(); navigate("/welcome"); }}
        variant="outline"
        className="w-full bg-surface border-destructive/40 text-destructive hover:bg-destructive/10"
      >
        <LogOut className="h-4 w-4 mr-2" /> Sign out
      </Button>

      <p className="text-center text-[11px] text-muted-foreground/70 pt-2">
         Designed &amp; Built by HIGHBEE 🍯🐝
      </p>

      <div className="h-4" />
    </div>
  );
};

const Row = ({ icon: Icon, label, value }: any) => (
  <div className="flex items-center gap-3 px-4 py-3">
    <Icon className="h-4 w-4 text-muted-foreground" />
    <span className="text-sm text-muted-foreground flex-1">{label}</span>
    <span className="text-sm font-medium text-right line-clamp-1 max-w-[55%]">{value}</span>
  </div>
);

export default Profile;

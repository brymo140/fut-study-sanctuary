import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Flame, Award, LogOut, GraduationCap, Building2, BookOpen, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Profile = () => {
  const { profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  const initials = (profile?.full_name || profile?.email || "U")
    .split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();

  const xp = profile?.xp || 0;
  const nextMilestone = Math.ceil((xp + 1) / 100) * 100;
  const pct = ((xp % 100) / 100) * 100;

  return (
    <div className="space-y-5">
      {/* Header card */}
      <div className="surface-card p-5 text-center bg-gradient-cover">
        <div className="inline-flex h-20 w-20 rounded-full bg-white/10 backdrop-blur items-center justify-center text-2xl font-bold text-white mb-3 overflow-hidden">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : initials}
        </div>
        <h1 className="text-xl font-bold text-white">{profile?.full_name || "Student"}</h1>
        <p className="text-sm text-white/80 mt-0.5">{profile?.email}</p>
        {isAdmin && <span className="badge-purple mt-2 inline-block">Admin</span>}
      </div>

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
            <span className="text-xs text-muted-foreground">Day streak</span>
            <Flame className="h-4 w-4 text-warning" />
          </div>
          <p className="text-2xl font-bold text-warning">{profile?.streak || 0}</p>
          <p className="text-[10px] text-muted-foreground mt-3">Open the app daily to keep it going</p>
        </div>
      </div>

      {/* Info */}
      <div className="surface-card divide-y divide-border">
        <Row icon={GraduationCap} label="Level" value={profile?.level || "—"} />
        <Row icon={Building2} label="Department" value={profile?.department || "—"} />
        <Row icon={BookOpen} label="Faculty" value={profile?.faculty || "—"} />
        <Row icon={Mail} label="Matric No" value={profile?.matric_no || "—"} />
      </div>

      {isAdmin && (
        <Button onClick={() => navigate("/admin")} variant="outline" className="w-full bg-surface border-secondary/40 text-secondary">
          Open admin panel
        </Button>
      )}

      <Button
        onClick={async () => { await signOut(); navigate("/welcome"); }}
        variant="outline"
        className="w-full bg-surface border-destructive/40 text-destructive hover:bg-destructive/10"
      >
        <LogOut className="h-4 w-4 mr-2" /> Sign out
      </Button>

      <div className="h-4" />
    </div>
  );
};

const Row = ({ icon: Icon, label, value }: any) => (
  <div className="flex items-center gap-3 px-4 py-3">
    <Icon className="h-4 w-4 text-muted-foreground" />
    <span className="text-sm text-muted-foreground flex-1">{label}</span>
    <span className="text-sm font-medium">{value}</span>
  </div>
);

export default Profile;

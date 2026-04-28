import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  full_name: string;
  email: string;
  level: string | null;
  department: string | null;
  faculty: string | null;
  matric_no: string | null;
  avatar_url: string | null;
  xp: number;
  streak: number;
  last_active: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  isRep: boolean;
  roleLabel: "Admin" | "Class Rep" | "Student";
  loading: boolean;
  roleLoading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const ADMIN_EMAIL = "lawalibrahimakorede@gmail.com";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isRep, setIsRep] = useState(false);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(true);

  const loadProfile = async (uid: string) => {
    setRoleLoading(true);
    const [{ data: profileData }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile(profileData as Profile | null);
    let admin = !!roles?.some((r) => r.role === "admin");
    const rep = !!roles?.some((r) => r.role === "rep");

    // Safety net: if the hardcoded admin email is logged in but doesn't have
    // the admin role yet (e.g. created before the trigger was in place),
    // upsert it now so /admin works on the next render.
    if (!admin && (profileData?.email || "").toLowerCase() === ADMIN_EMAIL) {
      const { error: insertErr } = await supabase
        .from("user_roles")
        .insert({ user_id: uid, role: "admin" });
      if (!insertErr) admin = true;
    }

    setIsAdmin(admin);
    setIsRep(rep);
    setRoleLoading(false);

    // Update streak / last_active
    if (profileData) {
      const today = new Date().toISOString().slice(0, 10);
      const last = profileData.last_active;
      if (last !== today) {
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        const newStreak = last === yesterday ? (profileData.streak || 0) + 1 : 1;
        await supabase
          .from("profiles")
          .update({ last_active: today, streak: newStreak })
          .eq("id", uid);
        setProfile({ ...profileData, last_active: today, streak: newStreak } as Profile);
      }
    }
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        setTimeout(() => loadProfile(newSession.user.id), 0);
      } else {
        setProfile(null);
        setIsAdmin(false);
        setRoleLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        loadProfile(s.user.id).finally(() => setLoading(false));
      } else {
        setRoleLoading(false);
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const refreshProfile = async () => {
    if (user) await loadProfile(user.id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const roleLabel: "Admin" | "Class Rep" | "Student" = isAdmin ? "Admin" : isRep ? "Class Rep" : "Student";

  return (
    <AuthContext.Provider
      value={{ session, user, profile, isAdmin, isRep, roleLabel, loading, roleLoading, refreshProfile, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

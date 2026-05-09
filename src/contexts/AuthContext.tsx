import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { withSchemaRetry } from "@/lib/supabaseRetry";
import { registerNativeAuthDeepLinks } from "@/lib/nativeDeepLinks";

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
  is_banned: boolean;
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

export const ADMIN_EMAILS = [
  "lawalibrahimakorede@gmail.com",
  "lawalibrahim1240brymo@gmail.com",
];
export const isHardcodedAdminEmail = (email?: string | null) =>
  !!email && ADMIN_EMAILS.includes(email.toLowerCase());

const ROLE_KEY = "hv_user_role";
const getStoredRole = () => (typeof window === "undefined" ? null : localStorage.getItem(ROLE_KEY));
const storeRole = (role: "admin" | "rep" | "student") => localStorage.setItem(ROLE_KEY, role);

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(() => getStoredRole() === "admin");
  const [isRep, setIsRep] = useState(() => getStoredRole() === "rep");
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(true);

  const loadProfile = async (uid: string, sessionEmail?: string | null) => {
    setRoleLoading(true);
    const [{ data: profileData }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    const emailForCheck = (sessionEmail || profileData?.email || "").toLowerCase();
    if (profileData?.is_banned && !isHardcodedAdminEmail(emailForCheck)) {
      setProfile(profileData as Profile);
      storeRole("student");
      setIsAdmin(false);
      setIsRep(false);
      setRoleLoading(false);
      toast.error("Your account has been suspended. Contact support.");
      await supabase.auth.signOut();
      return;
    }

    if (profileData?.is_banned && isHardcodedAdminEmail(emailForCheck)) {
      await withSchemaRetry(async () => await supabase.from("profiles").update({ is_banned: false }).eq("id", uid));
      profileData.is_banned = false;
    }

    // Normalize nullable numeric fields coming from DB.
    const normalizedProfile = profileData
      ? ({
          ...(profileData as any),
          xp: profileData.xp ?? 0,
          streak: profileData.streak ?? 0,
        } as Profile)
      : null;

    setProfile(normalizedProfile);
    let admin = !!roles?.some((r) => r.role === "admin");
    const rep = !!roles?.some((r) => r.role === "rep");

    // Safety net: every login, if this is the hardcoded admin email
    // (works for both email/password AND Google OAuth — uses session email
    // so it triggers even before/without a profile row), make sure the
    // admin role is present. Idempotent on every login.
    if (isHardcodedAdminEmail(emailForCheck)) {
      // Insert if missing — duplicate is fine, unique constraint will no-op.
      if (!admin) {
        const { error: insertErr } = await withSchemaRetry(async () => await supabase
          .from("user_roles")
          .insert({ user_id: uid, role: "admin" }));
        if (!insertErr || insertErr.code === "23505") admin = true;
      }
      admin = true;
    }

    setIsAdmin(admin);
    setIsRep(rep);
    storeRole(admin ? "admin" : rep ? "rep" : "student");
    setRoleLoading(false);

    // Update streak / last_active
    if (normalizedProfile) {
      const today = new Date().toISOString().slice(0, 10);
      const last = normalizedProfile.last_active;
      if (last !== today) {
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        const newStreak = last === yesterday ? (normalizedProfile.streak || 0) + 1 : 1;
        await withSchemaRetry(async () => await supabase
          .from("profiles")
          .update({ last_active: today, streak: newStreak })
          .eq("id", uid));
        setProfile({ ...normalizedProfile, last_active: today, streak: newStreak } as Profile);
      }
    }
  };

  useEffect(() => {
    // Honor "Remember me": if user opted out, clear stored session on a fresh
    // browser session (new tab/window where sessionStorage tab marker is missing).
    sessionStorage.setItem("hv_tab_open", "1");

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        // Immediate admin flag for hardcoded emails — no DB wait.
        if (isHardcodedAdminEmail(newSession.user.email)) {
          setIsAdmin(true);
          setIsRep(false);
          storeRole("admin");
        } else {
          const storedRole = getStoredRole();
          if (storedRole === "admin") setIsAdmin(true);
          if (storedRole === "rep") setIsRep(true);
        }
        setTimeout(() => loadProfile(newSession.user.id, newSession.user.email), 0);
      } else {
        setProfile(null);
        setIsAdmin(false);
        setIsRep(false);
        setRoleLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        if (isHardcodedAdminEmail(s.user.email)) {
          setIsAdmin(true);
          setIsRep(false);
          storeRole("admin");
        } else {
          const storedRole = getStoredRole();
          if (storedRole === "admin") setIsAdmin(true);
          if (storedRole === "rep") setIsRep(true);
        }
        loadProfile(s.user.id, s.user.email).finally(() => setLoading(false));
      } else {
        setRoleLoading(false);
        setLoading(false);
      }
    });

    // Native deep-link handler for OAuth callbacks (no-op on web).
    const cleanupDeepLinks = registerNativeAuthDeepLinks(() => {
      // Session is set by the listener; auth state change above will pick it up.
    });

    return () => {
      sub.subscription.unsubscribe();
      cleanupDeepLinks();
    };
  }, []);

  const refreshProfile = async () => {
    if (user) await loadProfile(user.id, user.email);
  };

  const signOut = async () => {
    localStorage.removeItem(ROLE_KEY);
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

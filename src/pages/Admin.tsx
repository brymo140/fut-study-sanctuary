import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth, isHardcodedAdminEmail } from "@/contexts/AuthContext";
import {
  BarChart3, FileText, Youtube, Users,
  Megaphone, Flag, Settings as SettingsIcon, MessageSquare
} from "lucide-react";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AdminPdfs } from "@/components/admin/AdminPdfs";
import { AdminYouTube } from "@/components/admin/AdminYouTube";
import { AdminUsers } from "@/components/admin/AdminUsers";
import { AdminAnnouncements } from "@/components/admin/AdminAnnouncements";
import { AdminReports } from "@/components/admin/AdminReports";
import { AdminSettings } from "@/components/admin/AdminSettings";
import { AdminFeedback } from "@/components/admin/AdminFeedback";

type TabKey =
  | "dashboard"
  | "pdfs"
  | "youtube"
  | "users"
  | "announcements"
  | "feedback"
  | "reports"
  | "settings";

// All tabs — admins see all, reps only see pdfs and youtube
const ALL_TABS: { key: TabKey; label: string; icon: any; repAllowed: boolean }[] = [
  { key: "dashboard",     label: "Dashboard", icon: BarChart3,     repAllowed: false },
  { key: "pdfs",          label: "PDFs",      icon: FileText,      repAllowed: true  },
  { key: "youtube",       label: "YouTube",   icon: Youtube,       repAllowed: true  },
  { key: "users",         label: "Users",     icon: Users,         repAllowed: false },
  { key: "announcements", label: "Notices",   icon: Megaphone,     repAllowed: false },
  { key: "feedback",      label: "Feedback",  icon: MessageSquare, repAllowed: false },
  { key: "reports",       label: "Reports",   icon: Flag,          repAllowed: false },
  { key: "settings",      label: "Settings",  icon: SettingsIcon,  repAllowed: false },
];

const Admin = () => {
  const { isAdmin, isRep, loading, session } = useAuth();

  // Determine visible tabs based on role
  const visibleTabs = ALL_TABS.filter((t) => {
    if (isAdmin || isHardcodedAdminEmail(session?.user?.email)) return true;
    if (isRep) return t.repAllowed;
    return false;
  });

  const [tab, setTab] = useState<TabKey>(
    visibleTabs.length > 0 ? visibleTabs[0].key : "pdfs"
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!session) return <Navigate to="/" replace />;

  const emailIsAdmin = isHardcodedAdminEmail(session.user.email);
  if (!isAdmin && !emailIsAdmin && !isRep) return <Navigate to="/" replace />;

  const isFullAdmin = isAdmin || emailIsAdmin;

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold gradient-text-brand">
            {isFullAdmin ? "Admin Panel" : "Rep Panel"}
          </h1>
          <p className="text-[11px] text-muted-foreground">
            {isFullAdmin
              ? "HighVault control center"
              : "Upload materials for your level"}
          </p>
        </div>
        <div className={isFullAdmin ? "badge-purple" : "badge-blue"}>
          {isFullAdmin ? "ADMIN" : "REP"}
        </div>
      </header>

      {/* Tab bar */}
      <div className="sticky top-0 z-20 -mx-4 px-4 py-2 bg-background/90 backdrop-blur border-b border-border">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {visibleTabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors border ${
                  active
                    ? "bg-primary/15 border-primary/50 text-primary"
                    : "bg-surface border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-2">
        {tab === "dashboard"     && <AdminDashboard />}
        {tab === "pdfs"          && <AdminPdfs />}
        {tab === "youtube"       && <AdminYouTube />}
        {tab === "users"         && <AdminUsers />}
        {tab === "announcements" && <AdminAnnouncements />}
        {tab === "feedback"      && <AdminFeedback />}
        {tab === "reports"       && <AdminReports />}
        {tab === "settings"      && <AdminSettings />}
      </div>
    </div>
  );
};

export default Admin;

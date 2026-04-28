import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { BarChart3, FileText, Youtube, Users, Megaphone, Flag, Settings as SettingsIcon } from "lucide-react";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AdminPdfs } from "@/components/admin/AdminPdfs";
import { AdminYouTube } from "@/components/admin/AdminYouTube";
import { AdminUsers } from "@/components/admin/AdminUsers";
import { AdminAnnouncements } from "@/components/admin/AdminAnnouncements";
import { AdminReports } from "@/components/admin/AdminReports";
import { AdminSettings } from "@/components/admin/AdminSettings";

type TabKey = "dashboard" | "pdfs" | "youtube" | "users" | "announcements" | "reports" | "settings";

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: "dashboard", label: "Dashboard", icon: BarChart3 },
  { key: "pdfs", label: "PDFs", icon: FileText },
  { key: "youtube", label: "YouTube", icon: Youtube },
  { key: "users", label: "Users", icon: Users },
  { key: "announcements", label: "Notices", icon: Megaphone },
  { key: "reports", label: "Reports", icon: Flag },
  { key: "settings", label: "Settings", icon: SettingsIcon },
];

const Admin = () => {
  const { isAdmin, loading, roleLoading, session } = useAuth();
  const [tab, setTab] = useState<TabKey>("dashboard");

  if (loading || (session && roleLoading)) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold gradient-text-brand">Admin panel</h1>
          <p className="text-[11px] text-muted-foreground">HighVault control center</p>
        </div>
        <div className="badge-purple">ADMIN</div>
      </header>

      {/* Tab bar — horizontal scroll on mobile */}
      <div className="sticky top-0 z-20 -mx-4 px-4 py-2 bg-background/90 backdrop-blur border-b border-border">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {TABS.map((t) => {
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
        {tab === "dashboard" && <AdminDashboard />}
        {tab === "pdfs" && <AdminPdfs />}
        {tab === "youtube" && <AdminYouTube />}
        {tab === "users" && <AdminUsers />}
        {tab === "announcements" && <AdminAnnouncements />}
        {tab === "reports" && <AdminReports />}
        {tab === "settings" && <AdminSettings />}
      </div>
    </div>
  );
};

export default Admin;

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, StatCard } from "./ui";

export const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalPdfs: 0,
    totalStudents: 0,
    downloadsToday: 0,
    activeAnnouncements: 0,
    topPdf: null as { title: string; download_count: number } | null,
    newest: null as { full_name: string; level: string | null; created_at: string } | null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const [pdfs, students, dlToday, ann, topPdf, newest] = await Promise.all([
        supabase.from("pdfs").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("downloads").select("id", { count: "exact", head: true }).gte("downloaded_at", startOfDay.toISOString()),
        supabase.from("announcements").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("pdfs").select("title,download_count").order("download_count", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("profiles").select("full_name,level,created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);

      setStats({
        totalPdfs: pdfs.count || 0,
        totalStudents: students.count || 0,
        downloadsToday: dlToday.count || 0,
        activeAnnouncements: ann.count || 0,
        topPdf: topPdf.data as any,
        newest: newest.data as any,
      });
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div>
      <SectionHeader title="Dashboard" subtitle="Live overview of HighVault activity" />
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total PDFs" value={stats.totalPdfs} />
            <StatCard label="Registered students" value={stats.totalStudents} />
            <StatCard label="Downloads today" value={stats.downloadsToday} />
            <StatCard label="Active announcements" value={stats.activeAnnouncements} />
          </div>

          <div className="grid grid-cols-1 gap-3 mt-4">
            <div className="surface-card p-4">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Most downloaded PDF</p>
              {stats.topPdf ? (
                <div className="mt-1.5">
                  <p className="text-sm font-semibold">{stats.topPdf.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {stats.topPdf.download_count} downloads
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">No PDFs yet.</p>
              )}
            </div>
            <div className="surface-card p-4">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Newest student</p>
              {stats.newest ? (
                <div className="mt-1.5">
                  <p className="text-sm font-semibold">{stats.newest.full_name || "Unnamed"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {stats.newest.level || "Level not set"} · joined{" "}
                    {new Date(stats.newest.created_at).toLocaleDateString()}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">No students yet.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

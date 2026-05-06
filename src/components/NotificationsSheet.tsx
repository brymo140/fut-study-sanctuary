import { useCallback, useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Bell, FileText, Megaphone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

interface NotifItem {
  key: string; // "ann-<id>" | "pdf-<id>"
  kind: "announcement" | "pdf";
  title: string;
  subtitle: string;
  created_at: string;
  href?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userLevel?: string | null;
  userDepartment?: string | null;
  /** Called whenever the read state changes so the bell badge can refresh. */
  onChange?: () => void;
}

export const NotificationsSheet = ({ open, onOpenChange, userLevel, userDepartment, onChange }: Props) => {
  const { user } = useAuth();
  const [items, setItems] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const since = new Date(Date.now() - 30 * 86400000).toISOString();

    const [{ data: ann }, { data: pdfs }, { data: reads }] = await Promise.all([
      supabase
        .from("announcements")
        .select("id,title,body,target_level,created_at,is_active")
        .gte("created_at", since)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("pdfs")
        .select("id,title,course_code,level,department,is_general,created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("notification_reads").select("announcement_id").eq("user_id", user.id),
    ]);

    const readKeys = new Set(((reads || []) as any[]).map((r) => r.announcement_id));

    const annList: NotifItem[] = ((ann || []) as any[])
      .filter((a) => !a.target_level || !userLevel || a.target_level === userLevel)
      .map((a) => ({
        key: `ann-${a.id}`,
        kind: "announcement",
        title: a.title,
        subtitle: a.body,
        created_at: a.created_at,
      }));

    const pdfList: NotifItem[] = ((pdfs || []) as any[])
      .filter((p) => {
        if (p.is_general) return true;
        if (userLevel && p.level !== userLevel) return false;
        if (p.department && userDepartment && p.department !== userDepartment) return false;
        return true;
      })
      .map((p) => ({
        key: `pdf-${p.id}`,
        kind: "pdf",
        title: `New material: ${p.title}`,
        subtitle: `${p.course_code} · ${p.level}`,
        created_at: p.created_at,
        href: `/pdf/${p.id}`,
      }));

    const merged = [...annList, ...pdfList]
      .filter((n) => !readKeys.has(n.key))
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

    setItems(merged);
    setLoading(false);
  }, [user, userLevel, userDepartment]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const dismiss = async (n: NotifItem, navigateTo?: string) => {
    if (!user) return;
    // Optimistic remove
    setItems((prev) => prev.filter((x) => x.key !== n.key));
    await supabase.from("notification_reads").upsert(
      { user_id: user.id, announcement_id: n.key },
      { onConflict: "user_id,announcement_id" }
    );
    onChange?.();
    if (navigateTo) {
      onOpenChange(false);
      navigate(navigateTo);
    }
  };

  const markAllRead = async () => {
    if (!user || items.length === 0) return;
    const rows = items.map((n) => ({ user_id: user.id, announcement_id: n.key }));
    setItems([]);
    await supabase.from("notification_reads").upsert(rows, { onConflict: "user_id,announcement_id" });
    onChange?.();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="bg-background border-border w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 justify-between">
            <span className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Notifications
            </span>
            {items.length > 0 && (
              <button onClick={markAllRead} className="text-[11px] text-primary font-medium hover:underline">
                Mark all read
              </button>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-2.5">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
          ) : items.length === 0 ? (
            <div className="surface-card p-8 text-center">
              <div className="text-4xl mb-3">🔔</div>
              <p className="text-sm text-muted-foreground">
                You're all caught up. No new notifications.
              </p>
            </div>
          ) : (
            items.map((n) => (
              <button
                key={n.key}
                onClick={() => dismiss(n, n.href)}
                className="w-full text-left surface-card p-3 hover:border-primary transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    {n.kind === "announcement" ? (
                      <Megaphone className="h-4 w-4 text-primary" />
                    ) : (
                      <FileText className="h-4 w-4 text-secondary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold line-clamp-1">{n.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {n.subtitle}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

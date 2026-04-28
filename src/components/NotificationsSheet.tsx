import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { Bell, FileText, Megaphone } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

interface NotifItem {
  id: string;
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
  onSeen?: () => void;
}

export const NotificationsSheet = ({ open, onOpenChange, userLevel, onSeen }: Props) => {
  const [items, setItems] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const since = new Date(Date.now() - 7 * 86400000).toISOString();

    Promise.all([
      supabase
        .from("announcements")
        .select("id,title,body,target_level,created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("pdfs")
        .select("id,title,course_code,level,created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(20),
    ]).then(([{ data: ann }, { data: pdfs }]) => {
      const annList: NotifItem[] = ((ann || []) as any[])
        .filter((a) => !a.target_level || !userLevel || a.target_level === userLevel)
        .map((a) => ({
          id: `ann-${a.id}`,
          kind: "announcement",
          title: a.title,
          subtitle: a.body,
          created_at: a.created_at,
        }));

      const pdfList: NotifItem[] = ((pdfs || []) as any[])
        .filter((p) => !userLevel || p.level === userLevel)
        .map((p) => ({
          id: `pdf-${p.id}`,
          kind: "pdf",
          title: `New PDF: ${p.title}`,
          subtitle: `${p.course_code} · ${p.level}`,
          created_at: p.created_at,
          href: `/pdf/${p.id}`,
        }));

      const merged = [...annList, ...pdfList].sort(
        (a, b) => +new Date(b.created_at) - +new Date(a.created_at)
      );
      setItems(merged);
      setLoading(false);
      // Mark seen
      localStorage.setItem("notifs:lastSeen", new Date().toISOString());
      onSeen?.();
    });
  }, [open, userLevel, onSeen]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="bg-background border-border w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Notifications
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
            items.map((n) => {
              const Inner = (
                <div className="surface-card p-3 hover:border-primary transition-colors">
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
                </div>
              );
              return n.href ? (
                <Link key={n.id} to={n.href} onClick={() => onOpenChange(false)}>
                  {Inner}
                </Link>
              ) : (
                <div key={n.id}>{Inner}</div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Announcement {
  id: string;
  title: string;
  body: string;
  target_level: string | null;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userLevel?: string | null;
}

export const AnnouncementsSheet = ({ open, onOpenChange, userLevel }: Props) => {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    let q = supabase
      .from("announcements")
      .select("id,title,body,target_level,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    q.then(({ data }) => {
      const list = (data || []) as Announcement[];
      // Show announcements that are global (null) or match user's level
      const filtered = userLevel
        ? list.filter((a) => !a.target_level || a.target_level === userLevel)
        : list;
      setItems(filtered);
      setLoading(false);
    });
  }, [open, userLevel]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="bg-background border-border w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Announcements
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
          ) : items.length === 0 ? (
            <div className="surface-card p-8 text-center">
              <div className="text-4xl mb-3">📢</div>
              <p className="text-sm text-muted-foreground">
                No announcements yet. Check back soon.
              </p>
            </div>
          ) : (
            items.map((a) => (
              <div key={a.id} className="surface-card p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="text-sm font-semibold">{a.title}</h3>
                  {a.target_level && (
                    <span className="badge-blue shrink-0">{a.target_level}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                </p>
                <p className="text-sm text-foreground/85 whitespace-pre-wrap leading-relaxed">
                  {a.body}
                </p>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

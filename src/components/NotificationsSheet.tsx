import { useCallback, useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Bell, FileText, ExternalLink, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

interface Announcement {
  id: string;
  title: string;
  body: string;
  target_level: string | null;
  created_at: string;
  attachment_url?: string | null;
  attachment_type?: string | null;
  attachment_name?: string | null;
  link_url?: string | null;
  link_label?: string | null;
  _read: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userLevel?: string | null;
  userDepartment?: string | null;
  onChange?: () => void;
}

export const NotificationsSheet = ({
  open, onOpenChange, userLevel, onChange,
}: Props) => {
  const { user } = useAuth();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const since = new Date(Date.now() - 30 * 86400000).toISOString();

    const [{ data: ann }, { data: reads }] = await Promise.all([
      supabase
        .from("announcements")
        .select("id,title,body,target_level,created_at,attachment_url,attachment_type,attachment_name,link_url,link_label")
        .eq("is_active", true)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("notification_reads")
        .select("announcement_id")
        .eq("user_id", user.id),
    ]);

    const readKeys = new Set(((reads || []) as any[]).map((r) => r.announcement_id));

    const list = ((ann || []) as any[])
      .filter((a) => !a.target_level || !userLevel || a.target_level === userLevel)
      .map((a) => ({
        ...a,
        _read: readKeys.has(`ann-${a.id}`),
      })) as Announcement[];

    setItems(list);
    setLoading(false);
  }, [user, userLevel]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const markRead = async (a: Announcement) => {
    if (!user || a._read) return;
    setItems((prev) =>
      prev.map((x) => x.id === a.id ? { ...x, _read: true } : x)
    );
    await supabase.from("notification_reads").upsert(
      { user_id: user.id, announcement_id: `ann-${a.id}` },
      { onConflict: "user_id,announcement_id" }
    );
    onChange?.();
  };

  const markAllRead = async () => {
    if (!user) return;
    const unread = items.filter((i) => !i._read);
    if (unread.length === 0) return;
    setItems((prev) => prev.map((x) => ({ ...x, _read: true })));
    await supabase.from("notification_reads").upsert(
      unread.map((a) => ({ user_id: user.id, announcement_id: `ann-${a.id}` })),
      { onConflict: "user_id,announcement_id" }
    );
    onChange?.();
  };

  const handleLinkTap = (url: string, item: Announcement) => {
    markRead(item);
    if (url.startsWith("/")) {
      onOpenChange(false);
      navigate(url);
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const unreadCount = items.filter((i) => !i._read).length;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="bg-background border-border w-full sm:max-w-md overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Notifications
                {unreadCount > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </span>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[11px] text-primary font-medium hover:underline"
                >
                  Mark all read
                </button>
              )}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
            ) : items.length === 0 ? (
              <div className="surface-card p-8 text-center">
                <div className="text-4xl mb-3">🔔</div>
                <p className="text-sm text-muted-foreground">
                  No announcements yet. Check back soon.
                </p>
              </div>
            ) : (
              items.map((a) => (
                <div
                  key={a.id}
                  className={`surface-card p-4 space-y-2 transition-colors ${
                    !a._read ? "border-primary/30 bg-primary/[0.03]" : ""
                  }`}
                  onClick={() => markRead(a)}
                >
                  {/* Unread dot + header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      {!a._read && (
                        <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                      )}
                      <h3 className="text-sm font-semibold line-clamp-2">{a.title}</h3>
                    </div>
                    {a.target_level && (
                      <span className="badge-blue shrink-0">{a.target_level}</span>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                  </p>

                  <p className="text-sm text-foreground/85 whitespace-pre-wrap leading-relaxed">
                    {a.body}
                  </p>

                  {/* Image attachment */}
                  {a.attachment_url && a.attachment_type === "image" && (
                    <div className="mt-2">
                      <img
                        src={a.attachment_url}
                        alt={a.attachment_name || "Image"}
                        className="w-full rounded-lg object-cover max-h-48 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLightboxImg(a.attachment_url!);
                        }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <p className="text-[10px] text-muted-foreground mt-1 text-center">
                        Tap to view full size
                      </p>
                    </div>
                  )}

                  {/* PDF attachment */}
                  {a.attachment_url && a.attachment_type === "pdf" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(a.attachment_url!, "_blank", "noopener,noreferrer");
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2.5 bg-primary/10 border border-primary/30 rounded-lg text-primary text-xs font-semibold mt-2"
                    >
                      <FileText className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-left truncate">
                        {a.attachment_name || "View PDF"}
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    </button>
                  )}

                  {/* Link button */}
                  {a.link_url && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLinkTap(a.link_url!, a);
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2.5 bg-gradient-button border border-primary/40 rounded-lg text-primary text-xs font-semibold mt-1"
                    >
                      <ArrowRight className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-left">
                        {a.link_label || "Visit Link"}
                      </span>
                      {!a.link_url.startsWith("/") && (
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      )}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Image lightbox */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxImg(null)}
        >
          <img
            src={lightboxImg}
            alt="Full size"
            className="max-w-full max-h-full rounded-lg object-contain"
          />
          <button
            className="absolute top-4 right-4 text-white text-2xl font-bold h-10 w-10 rounded-full bg-black/50 flex items-center justify-center"
            onClick={() => setLightboxImg(null)}
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
};

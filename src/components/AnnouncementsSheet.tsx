import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone, FileText, ExternalLink } from "lucide-react";
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
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userLevel?: string | null;
}

export const AnnouncementsSheet = ({ open, onOpenChange, userLevel }: Props) => {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("announcements")
      .select("id,title,body,target_level,created_at,attachment_url,attachment_type,attachment_name")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        const list = (data || []) as Announcement[];
        const filtered = userLevel
          ? list.filter((a) => !a.target_level || a.target_level === userLevel)
          : list;
        setItems(filtered);
        setLoading(false);
      });
  }, [open, userLevel]);

  const openPdf = (url: string) => {
    // iOS opens in Safari, Android opens in new tab
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="bg-background border-border w-full sm:max-w-md overflow-y-auto"
        >
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
                <div key={a.id} className="surface-card p-4 space-y-2">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold">{a.title}</h3>
                    {a.target_level && (
                      <span className="badge-blue shrink-0">{a.target_level}</span>
                    )}
                  </div>

                  {/* Time */}
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                  </p>

                  {/* Body */}
                  <p className="text-sm text-foreground/85 whitespace-pre-wrap leading-relaxed">
                    {a.body}
                  </p>

                  {/* Attachment */}
                  {a.attachment_url && a.attachment_type === 'image' && (
                    <div className="mt-2">
                      <img
                        src={a.attachment_url}
                        alt={a.attachment_name || 'Attachment'}
                        className="w-full rounded-lg object-cover max-h-48 cursor-pointer"
                        onClick={() => setLightboxImg(a.attachment_url!)}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <p className="text-[10px] text-muted-foreground mt-1 text-center">
                        Tap image to view full size
                      </p>
                    </div>
                  )}

                  {a.attachment_url && a.attachment_type === 'pdf' && (
                    <button
                      onClick={() => openPdf(a.attachment_url!)}
                      className="flex items-center gap-2 w-full px-3 py-2.5 bg-primary/10 border border-primary/30 rounded-lg text-primary text-xs font-semibold mt-2"
                    >
                      <FileText className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-left truncate">
                        {a.attachment_name || 'View attached PDF'}
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
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
            className="absolute top-4 right-4 text-white text-2xl font-bold"
            onClick={() => setLightboxImg(null)}
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
};

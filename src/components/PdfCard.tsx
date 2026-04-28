import { Link } from "react-router-dom";
import { FileText, Download, Star, MoreVertical, Bookmark } from "lucide-react";

export interface PdfSummary {
  id: string;
  title: string;
  course_code: string;
  level: string;
  total_chapters: number;
  file_size_mb: number | null;
  download_count: number;
  is_past_question?: boolean;
  is_verified?: boolean;
  cover_url?: string | null;
}

interface Props {
  pdf: PdfSummary;
  rating?: number;
  bookmarked?: boolean;
  onBookmark?: () => void;
  variant?: "list" | "trending";
}

export const PdfCard = ({ pdf, rating, bookmarked, onBookmark, variant = "list" }: Props) => {
  if (variant === "trending") {
    return (
      <Link
        to={`/pdf/${pdf.id}`}
        className="shrink-0 w-40 surface-card p-3 hover:border-primary transition-colors"
      >
        <div className="aspect-[3/4] rounded-lg bg-gradient-cover mb-3 flex items-center justify-center">
          <FileText className="h-10 w-10 text-white/80" />
        </div>
        <p className="text-sm font-semibold line-clamp-2 mb-1">{pdf.title}</p>
        <p className="text-[11px] text-muted-foreground mb-2">
          {pdf.course_code} · {pdf.total_chapters} ch
        </p>
        <div className="flex items-center justify-between">
          <span className="badge-blue">{pdf.level}</span>
          {rating !== undefined && (
            <span className="flex items-center gap-0.5 text-[11px] text-warning">
              <Star className="h-3 w-3 fill-warning" />
              {rating.toFixed(1)}
            </span>
          )}
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={`/pdf/${pdf.id}`}
      className="surface-card p-3 flex gap-3 hover:border-primary transition-colors group"
    >
      <div className="h-16 w-16 shrink-0 rounded-lg bg-gradient-cover flex items-center justify-center">
        <FileText className="h-7 w-7 text-white/80" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold line-clamp-1">{pdf.title}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {pdf.course_code} · {pdf.file_size_mb?.toFixed(1) || "—"} MB · {pdf.total_chapters} ch
            </p>
          </div>
          {onBookmark && (
            <button
              onClick={(e) => { e.preventDefault(); onBookmark(); }}
              aria-label="Bookmark"
              className="p-1 rounded hover:bg-muted shrink-0"
            >
              <Bookmark className={`h-4 w-4 ${bookmarked ? "fill-primary text-primary" : "text-muted-foreground"}`} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-2">
          <span className="badge-blue">{pdf.level}</span>
          {pdf.is_past_question && <span className="badge-amber">Past Q</span>}
          {pdf.is_verified && <span className="badge-green">✓ Verified</span>}
        </div>
      </div>
      <div className="flex flex-col items-end justify-between shrink-0">
        <Download className="h-4 w-4 text-primary" />
        <span className="text-[11px] text-primary font-medium">Watch</span>
      </div>
    </Link>
  );
};

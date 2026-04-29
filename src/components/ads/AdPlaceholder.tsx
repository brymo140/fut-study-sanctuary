// ADMOB READY — visual placeholder used inside ad modals. Swap with real
// AdMob/AdSense rendering on conversion; nothing else needs to change.
interface Props {
  label: string;
  note?: string;
  className?: string;
}

export const AdPlaceholder = ({ label, note, className = "" }: Props) => (
  <div
    className={`w-full min-h-[180px] rounded-xl border border-dashed border-primary/40 bg-surface flex flex-col items-center justify-center gap-2 px-4 py-6 ${className}`}
  >
    <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Ad space</span>
    <p className="text-sm font-semibold text-foreground/90 text-center">{label}</p>
    {note && <p className="text-[10px] text-muted-foreground text-center">{note}</p>}
  </div>
);

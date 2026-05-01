import { ReactNode } from "react";

export const SectionHeader = ({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) => (
  <div className="flex items-end justify-between mb-4">
    <div>
      <h2 className="text-lg font-bold">{title}</h2>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
    {right}
  </div>
);

export const Field = ({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) => (
  <label className="block">
    <span className="block text-xs font-semibold text-foreground/80 mb-1.5">{label}</span>
    {children}
    {hint && <span className="block text-[10px] text-muted-foreground mt-1">{hint}</span>}
  </label>
);

export const inputClass =
  "w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary placeholder:text-muted-foreground";

export const StatCard = ({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) => (
  <div className="surface-card p-4">
    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="text-2xl font-bold mt-1 gradient-text-brand">{value}</p>
    {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
  </div>
);

export const TableShell = ({ children }: { children: ReactNode }) => (
  <div className="surface-card overflow-x-auto">
    <table className="w-full text-xs">{children}</table>
  </div>
);

export const Th = ({ children }: { children: ReactNode }) => (
  <th className="text-left font-semibold text-muted-foreground px-3 py-2.5 whitespace-nowrap border-b border-border">
    {children}
  </th>
);

export const Td = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <td className={`px-3 py-2.5 border-b border-border/50 ${className}`}>{children}</td>
);

export const ActionBtn = ({
  children,
  onClick,
  tone = "default",
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "default" | "danger" | "primary" | "success";
}) => {
  const tones: Record<string, string> = {
    default: "bg-surface border-border hover:border-primary text-foreground/80",
    danger: "bg-destructive/10 border-destructive/40 hover:border-destructive text-destructive",
    primary: "bg-primary/10 border-primary/40 hover:border-primary text-primary",
    success: "bg-success/10 border-success/40 hover:border-success text-success",
  };
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-medium transition-colors ${tones[tone]}`}
    >
      {children}
    </button>
  );
};

export const EmptyRow = ({ cols, text }: { cols: number; text: string }) => (
  <tr>
    <td colSpan={cols} className="px-3 py-8 text-center text-sm text-muted-foreground">
      {text}
    </td>
  </tr>
);

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageSquare, CheckCircle2, Clock, Eye } from "lucide-react";
import { SectionHeader, TableShell, Th, Td, ActionBtn, EmptyRow } from "./ui";
import { getDatabaseErrorMessage, withSchemaRetry } from "@/lib/supabaseRetry";

interface FeedbackItem {
  id: string;
  user_id: string;
  full_name: string | null;
  level: string | null;
  subject_name: string;
  note: string | null;
  status: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "badge-amber",
  reviewed: "badge-blue",
  resolved: "badge-green",
};

export const AdminFeedback = () => {
  const [list, setList] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<FeedbackItem | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "reviewed" | "resolved">("all");

  const reload = async () => {
    setLoading(true);
    let q = supabase
      .from("feedback")
      .select("*")
      .order("created_at", { ascending: false });

    if (filter !== "all") q = q.eq("status", filter);

    const { data, error } = await q;
    if (error) {
      toast.error(getDatabaseErrorMessage(error));
    } else {
      setList((data || []) as FeedbackItem[]);
    }
    setLoading(false);
  };

  useEffect(() => { reload(); }, [filter]);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await withSchemaRetry(async () =>
      await supabase.from("feedback").update({ status }).eq("id", id)
    );
    if (error) {
      toast.error(getDatabaseErrorMessage(error));
      return;
    }
    toast.success(`Marked as ${status}`);
    if (selected?.id === id) setSelected({ ...selected, status });
    reload();
  };

  const pending = list.filter(f => f.status === "pending").length;
  const resolved = list.filter(f => f.status === "resolved").length;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Student Feedback"
        subtitle="Material requests and complaints from students"
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="surface-card p-3 text-center">
          <p className="text-2xl font-bold text-warning">{pending}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Pending</p>
        </div>
        <div className="surface-card p-3 text-center">
          <p className="text-2xl font-bold">{list.length}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Total</p>
        </div>
        <div className="surface-card p-3 text-center">
          <p className="text-2xl font-bold text-success">{resolved}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Resolved</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {(["all", "pending", "reviewed", "resolved"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border transition-colors ${
              filter === f
                ? "bg-primary/15 border-primary/50 text-primary"
                : "bg-surface border-border text-muted-foreground"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="surface-card h-12 animate-pulse" />)}
        </div>
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>Student</Th>
              <Th>Level</Th>
              <Th>Material Requested</Th>
              <Th>Date</Th>
              <Th>Status</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <EmptyRow cols={6} text="No feedback received yet." />
            ) : list.map((f) => (
              <tr key={f.id}>
                <Td className="font-medium">{f.full_name || "Anonymous"}</Td>
                <Td>{f.level || "—"}</Td>
                <Td className="max-w-[160px] truncate">{f.subject_name}</Td>
                <Td className="text-muted-foreground text-xs">
                  {new Date(f.created_at).toLocaleDateString()}
                </Td>
                <Td>
                  <span className={STATUS_COLORS[f.status] || "badge-amber"}>
                    {f.status}
                  </span>
                </Td>
                <Td>
                  <div className="flex gap-1">
                    <ActionBtn onClick={() => setSelected(f)}>
                      <Eye className="h-3 w-3" />
                    </ActionBtn>
                    {f.status === "pending" && (
                      <ActionBtn tone="primary" onClick={() => updateStatus(f.id, "reviewed")}>
                        Review
                      </ActionBtn>
                    )}
                    {f.status !== "resolved" && (
                      <ActionBtn tone="primary" onClick={() => updateStatus(f.id, "resolved")}>
                        <CheckCircle2 className="h-3 w-3" />
                      </ActionBtn>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}

      {/* Detail modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="surface-card p-5 w-full max-w-md space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <p className="text-sm font-bold">Feedback Detail</p>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="surface-card p-2.5">
                  <p className="text-[10px] text-muted-foreground">Student</p>
                  <p className="text-xs font-semibold mt-0.5">
                    {selected.full_name || "Anonymous"}
                  </p>
                </div>
                <div className="surface-card p-2.5">
                  <p className="text-[10px] text-muted-foreground">Level</p>
                  <p className="text-xs font-semibold mt-0.5">{selected.level || "—"}</p>
                </div>
              </div>

              <div className="surface-card p-3">
                <p className="text-[10px] text-muted-foreground mb-1">Material Requested</p>
                <p className="text-sm font-semibold">{selected.subject_name}</p>
              </div>

              {selected.note && (
                <div className="surface-card p-3">
                  <p className="text-[10px] text-muted-foreground mb-1">Additional Note</p>
                  <p className="text-xs text-foreground/85 whitespace-pre-wrap leading-relaxed">
                    {selected.note}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {new Date(selected.created_at).toLocaleString()}
                </div>
                <span className={STATUS_COLORS[selected.status] || "badge-amber"}>
                  {selected.status}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setSelected(null)}
                className="flex-1 surface-card py-2 text-xs"
              >
                Close
              </button>
              {selected.status === "pending" && (
                <button
                  onClick={() => updateStatus(selected.id, "reviewed")}
                  className="flex-1 bg-surface border border-primary/40 text-primary py-2 text-xs font-semibold rounded-lg"
                >
                  Mark Reviewed
                </button>
              )}
              {selected.status !== "resolved" && (
                <button
                  onClick={() => { updateStatus(selected.id, "resolved"); setSelected(null); }}
                  className="flex-1 bg-gradient-button border border-success/40 text-success py-2 text-xs font-semibold rounded-lg"
                >
                  Mark Resolved
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

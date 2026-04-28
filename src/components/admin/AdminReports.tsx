import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, X, Trash2 } from "lucide-react";
import { SectionHeader, TableShell, Th, Td, ActionBtn, EmptyRow } from "./ui";

interface Report {
  id: string; pdf_id: string; user_id: string; reason: string; created_at: string;
  pdf_title?: string; reporter_name?: string;
}

export const AdminReports = () => {
  const [list, setList] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    const { data } = await supabase.from("reports").select("*").order("created_at", { ascending: false });
    const reports = (data || []) as Report[];

    if (reports.length) {
      const pdfIds = [...new Set(reports.map((r) => r.pdf_id))];
      const userIds = [...new Set(reports.map((r) => r.user_id))];
      const [{ data: pdfs }, { data: users }] = await Promise.all([
        supabase.from("pdfs").select("id,title").in("id", pdfIds),
        supabase.from("profiles").select("id,full_name,email").in("id", userIds),
      ]);
      const pdfMap = new Map((pdfs || []).map((p: any) => [p.id, p.title]));
      const userMap = new Map((users || []).map((u: any) => [u.id, u.full_name || u.email]));
      reports.forEach((r) => {
        r.pdf_title = pdfMap.get(r.pdf_id) || "(deleted)";
        r.reporter_name = userMap.get(r.user_id) || "Unknown";
      });
    }
    setList(reports);
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  const dismiss = async (id: string) => {
    await supabase.from("reports").delete().eq("id", id);
    toast.success("Report dismissed"); reload();
  };
  const deletePdf = async (r: Report) => {
    if (!confirm(`Delete the reported PDF "${r.pdf_title}"?`)) return;
    await supabase.from("chapters").delete().eq("pdf_id", r.pdf_id);
    await supabase.from("pdfs").delete().eq("id", r.pdf_id);
    await supabase.from("reports").delete().eq("pdf_id", r.pdf_id);
    toast.success("PDF and related reports removed"); reload();
  };

  return (
    <div className="space-y-4">
      <SectionHeader title="Reports" subtitle="Flagged PDFs awaiting your review" />
      <TableShell>
        <thead><tr><Th>PDF</Th><Th>Reporter</Th><Th>Reason</Th><Th>Date</Th><Th>Actions</Th></tr></thead>
        <tbody>
          {loading ? <EmptyRow cols={5} text="Loading…" /> :
            list.length === 0 ? <EmptyRow cols={5} text="🎉 No flagged content. All clear." /> :
            list.map((r) => (
              <tr key={r.id}>
                <Td className="font-medium max-w-[160px] truncate">{r.pdf_title}</Td>
                <Td>{r.reporter_name}</Td>
                <Td className="max-w-[200px] truncate" title={r.reason}>{r.reason}</Td>
                <Td className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</Td>
                <Td>
                  <div className="flex gap-1">
                    <Link to={`/pdf/${r.pdf_id}`}><ActionBtn><Eye className="h-3 w-3" /></ActionBtn></Link>
                    <ActionBtn tone="primary" onClick={() => dismiss(r.id)}><X className="h-3 w-3" /></ActionBtn>
                    <ActionBtn tone="danger" onClick={() => deletePdf(r)}><Trash2 className="h-3 w-3" /></ActionBtn>
                  </div>
                </Td>
              </tr>
            ))}
        </tbody>
      </TableShell>
    </div>
  );
};

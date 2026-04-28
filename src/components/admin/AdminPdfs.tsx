import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Trash2, Pencil, Check, X, Upload } from "lucide-react";
import { SectionHeader, Field, inputClass, TableShell, Th, Td, ActionBtn, EmptyRow } from "./ui";

const LEVELS = ["100L", "200L", "300L", "400L", "500L"] as const;

interface Pdf {
  id: string;
  title: string;
  course_code: string;
  level: string;
  department: string | null;
  faculty: string | null;
  tags: string[] | null;
  is_verified: boolean;
  total_chapters: number;
  download_count: number;
  created_at: string;
}

export const AdminPdfs = () => {
  const { user } = useAuth();
  const [list, setList] = useState<Pdf[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Pdf | null>(null);
  const [busy, setBusy] = useState(false);

  // form state
  const empty = { title: "", course_code: "", level: "100L", department: "", faculty: "", tags: "", is_verified: false };
  const [form, setForm] = useState(empty);
  const [files, setFiles] = useState<File[]>([]);

  const reload = async () => {
    const { data } = await supabase
      .from("pdfs")
      .select("id,title,course_code,level,department,faculty,tags,is_verified,total_chapters,download_count,created_at")
      .order("created_at", { ascending: false });
    setList((data || []) as Pdf[]);
  };

  useEffect(() => { reload(); }, []);

  const upload = async () => {
    if (!user) return;
    if (!form.title || !form.course_code) { toast.error("Title and course code required"); return; }
    if (files.length === 0) { toast.error("Attach at least one chapter file"); return; }

    setBusy(true);
    try {
      const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
      const totalSize = files.reduce((s, f) => s + f.size, 0) / (1024 * 1024);

      const { data: pdf, error } = await supabase.from("pdfs").insert({
        title: form.title,
        course_code: form.course_code,
        level: form.level as any,
        department: form.department || null,
        faculty: form.faculty || null,
        tags,
        is_verified: form.is_verified,
        total_chapters: files.length,
        file_size_mb: Math.round(totalSize * 10) / 10,
        uploader_id: user.id,
      }).select().single();
      if (error) throw error;

      // Upload chapters
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const path = `${pdf.id}/ch${i + 1}-${Date.now()}-${f.name}`;
        const { error: upErr } = await supabase.storage.from("chapters").upload(path, f);
        if (upErr) throw upErr;
        await supabase.from("chapters").insert({
          pdf_id: pdf.id,
          chapter_number: i + 1,
          title: f.name.replace(/\.[^.]+$/, ""),
          storage_path: path,
          file_size_mb: Math.round((f.size / (1024 * 1024)) * 10) / 10,
        });
      }

      toast.success("PDF uploaded");
      setForm(empty); setFiles([]);
      reload();
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const toggleVerified = async (p: Pdf) => {
    await supabase.from("pdfs").update({ is_verified: !p.is_verified }).eq("id", p.id);
    reload();
  };

  const remove = async (p: Pdf) => {
    if (!confirm(`Delete "${p.title}"? This also removes its chapters.`)) return;
    await supabase.from("chapters").delete().eq("pdf_id", p.id);
    await supabase.from("pdfs").delete().eq("id", p.id);
    toast.success("PDF deleted");
    reload();
  };

  const saveEdit = async () => {
    if (!editing) return;
    await supabase.from("pdfs").update({
      title: editing.title,
      course_code: editing.course_code,
      level: editing.level as any,
      department: editing.department,
      faculty: editing.faculty,
      tags: editing.tags,
      is_verified: editing.is_verified,
    }).eq("id", editing.id);
    setEditing(null);
    toast.success("Updated");
    reload();
  };

  const filtered = list.filter((p) =>
    !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.course_code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <SectionHeader title="PDFs" subtitle="Upload course materials and manage the library" />

      {/* Upload form */}
      <div className="surface-card p-4 space-y-3">
        <p className="text-sm font-bold flex items-center gap-2"><Upload className="h-4 w-4 text-primary" /> Upload new PDF</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Title"><input className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Course code"><input className={inputClass} value={form.course_code} onChange={(e) => setForm({ ...form, course_code: e.target.value })} placeholder="CSC101" /></Field>
          <Field label="Level">
            <select className={inputClass} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </Field>
          <Field label="Department"><input className={inputClass} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></Field>
          <Field label="Faculty"><input className={inputClass} value={form.faculty} onChange={(e) => setForm({ ...form, faculty: e.target.value })} /></Field>
          <Field label="Tags" hint="Comma separated"><input className={inputClass} value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="General Course, Past Q" /></Field>
        </div>
        <Field label="Chapter files" hint="Each file becomes one chapter">
          <input type="file" multiple accept="application/pdf" onChange={(e) => setFiles(Array.from(e.target.files || []))}
            className="block w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-border file:bg-surface file:text-foreground file:text-xs" />
        </Field>
        {files.length > 0 && <p className="text-[11px] text-muted-foreground">{files.length} file{files.length > 1 ? "s" : ""} selected</p>}
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={form.is_verified} onChange={(e) => setForm({ ...form, is_verified: e.target.checked })} />
          <span>Mark as Rep Verified</span>
        </label>
        <button disabled={busy} onClick={upload} className="w-full bg-gradient-button border border-primary/40 text-primary text-sm font-semibold rounded-lg py-2.5 disabled:opacity-50">
          {busy ? "Uploading…" : "Upload PDF"}
        </button>
      </div>

      {/* Manage table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold">Manage PDFs ({list.length})</p>
          <input className={`${inputClass} max-w-[200px]`} placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <TableShell>
          <thead><tr>
            <Th>Title</Th><Th>Code</Th><Th>Level</Th><Th>Ch</Th><Th>DLs</Th><Th>Verified</Th><Th>Date</Th><Th>Actions</Th>
          </tr></thead>
          <tbody>
            {filtered.length === 0 ? <EmptyRow cols={8} text="No PDFs match." /> : filtered.map((p) => (
              <tr key={p.id}>
                <Td className="font-medium max-w-[180px] truncate">{p.title}</Td>
                <Td>{p.course_code}</Td>
                <Td>{p.level}</Td>
                <Td>{p.total_chapters}</Td>
                <Td>{p.download_count}</Td>
                <Td>{p.is_verified ? <span className="badge-green">✓</span> : <span className="text-muted-foreground">—</span>}</Td>
                <Td className="text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</Td>
                <Td>
                  <div className="flex gap-1">
                    <ActionBtn onClick={() => setEditing(p)}><Pencil className="h-3 w-3" /></ActionBtn>
                    <ActionBtn tone="primary" onClick={() => toggleVerified(p)}>{p.is_verified ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}</ActionBtn>
                    <ActionBtn tone="danger" onClick={() => remove(p)}><Trash2 className="h-3 w-3" /></ActionBtn>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="surface-card p-5 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold">Edit PDF</p>
            <Field label="Title"><input className={inputClass} value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></Field>
            <Field label="Course code"><input className={inputClass} value={editing.course_code} onChange={(e) => setEditing({ ...editing, course_code: e.target.value })} /></Field>
            <Field label="Level">
              <select className={inputClass} value={editing.level} onChange={(e) => setEditing({ ...editing, level: e.target.value })}>
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </Field>
            <Field label="Department"><input className={inputClass} value={editing.department || ""} onChange={(e) => setEditing({ ...editing, department: e.target.value })} /></Field>
            <Field label="Tags (comma separated)">
              <input className={inputClass} value={(editing.tags || []).join(", ")}
                onChange={(e) => setEditing({ ...editing, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} />
            </Field>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={editing.is_verified} onChange={(e) => setEditing({ ...editing, is_verified: e.target.checked })} />
              <span>Rep Verified</span>
            </label>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditing(null)} className="flex-1 surface-card py-2 text-xs">Cancel</button>
              <button onClick={saveEdit} className="flex-1 bg-gradient-button border border-primary/40 text-primary py-2 text-xs font-semibold rounded-lg">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

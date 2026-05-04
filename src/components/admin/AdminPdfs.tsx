import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Trash2, Pencil, Check, X, Upload, Plus, BookOpen, ArrowLeft } from "lucide-react";
import { SectionHeader, Field, inputClass, TableShell, Th, Td, ActionBtn, EmptyRow } from "./ui";
import { getDatabaseErrorMessage, withSchemaRetry } from "@/lib/supabaseRetry";
import { sendPushNotification } from "@/lib/pushNotifications";

const LEVELS = ["100L", "200L", "300L", "400L", "500L"] as const;

interface Subject {
  id: string;
  title: string;
  course_code: string;
  level: string;
  department: string | null;
  faculty: string | null;
  description: string | null;
  cover_url: string | null;
  tags: string[] | null;
  is_verified: boolean;
  total_chapters: number;
  download_count: number;
  created_at: string;
}

interface ModuleRow {
  module_number: number;
  module_title: string;
  file: File | null;
}

type Step = "list" | "subject" | "modules";

export const AdminPdfs = () => {
  const { user } = useAuth();
  const [list, setList] = useState<Subject[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Subject | null>(null);
  const [busy, setBusy] = useState(false);

  const [step, setStep] = useState<Step>("list");
  const [activeSubject, setActiveSubject] = useState<Subject | null>(null);

  const emptySubject = {
    title: "",
    course_code: "",
    level: "100L",
    department: "",
    faculty: "",
    description: "",
    cover_url: "",
    tags: "",
    is_verified: false,
  };
  const [subjectForm, setSubjectForm] = useState(emptySubject);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const [modules, setModules] = useState<ModuleRow[]>([
    { module_number: 1, module_title: "", file: null },
  ]);

  const reload = async () => {
    const { data } = await supabase
      .from("pdfs")
      .select("id,title,course_code,level,department,faculty,description,cover_url,tags,is_verified,total_chapters,download_count,created_at")
      .order("created_at", { ascending: false });
    setList((data || []) as Subject[]);
  };

  useEffect(() => { reload(); }, []);

  /* ---------- Step 1: create subject ---------- */
  const createSubject = async () => {
    if (!user) return;
    if (!subjectForm.title || !subjectForm.course_code) {
      toast.error("Title and course code required"); return;
    }
    setBusy(true);
    try {
      let coverUrl: string | null = subjectForm.cover_url.trim() || null;
      if (coverFile) {
        const path = `subject-${Date.now()}-${coverFile.name}`;
        const { error: upErr } = await supabase.storage.from("covers").upload(path, coverFile, { upsert: true });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("covers").getPublicUrl(path);
        coverUrl = pub.publicUrl;
      }
      const tags = subjectForm.tags.split(",").map((t) => t.trim()).filter(Boolean);
      const subjectPayload = {
        title: subjectForm.title,
        course_code: subjectForm.course_code,
        level: subjectForm.level as any,
        department: subjectForm.department || null,
        faculty: subjectForm.faculty || null,
        description: subjectForm.description || null,
        cover_url: coverUrl,
        tags,
        is_verified: subjectForm.is_verified,
        total_chapters: 0,
        uploader_id: user.id,
      };
      const { data: subj, error } = await withSchemaRetry(async () => await supabase.from("pdfs").insert(subjectPayload).select().single());
      if (error) throw error;
      setActiveSubject(subj as Subject);
      setModules([{ module_number: 1, module_title: "", file: null }]);
      setStep("modules");
      sendPushNotification({
        target_level: subjectForm.level,
        target_department: subjectForm.department || null,
        title: "HighVault 📚",
        body: `New study material added for ${subjectForm.level} students! 📚`,
        url: `/pdf/${(subj as Subject).id}`,
      });
      toast.success("Subject created — now add modules");
      reload();
    } catch (e: any) {
      toast.error(e.message || "Failed to create subject");
    } finally {
      setBusy(false);
    }
  };

  /* ---------- Step 2: upload modules ---------- */
  const updateModule = (idx: number, patch: Partial<ModuleRow>) => {
    setModules((prev) => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
  };
  const addModule = () => {
    setModules((prev) => [
      ...prev,
      { module_number: (prev[prev.length - 1]?.module_number || 0) + 1, module_title: "", file: null },
    ]);
  };
  const removeModule = (idx: number) => {
    setModules((prev) => prev.filter((_, i) => i !== idx));
  };

  const saveAllModules = async () => {
    if (!activeSubject) return;
    const valid = modules.filter((m) => m.module_title.trim() && m.file);
    if (valid.length === 0) { toast.error("Add at least one module with title and file"); return; }
    setBusy(true);
    try {
      let totalSize = 0;
      for (const m of valid) {
        const f = m.file!;
        totalSize += f.size;
        const path = `${activeSubject.id}/m${m.module_number}-${Date.now()}-${f.name}`;
        const { error: upErr } = await supabase.storage.from("chapters").upload(path, f);
        if (upErr) throw upErr;
        const { error: chapterErr } = await withSchemaRetry(async () => await supabase.from("chapters").insert({
          pdf_id: activeSubject.id,
          chapter_number: m.module_number,
          title: m.module_title,
          storage_path: path,
          file_size_mb: Math.round((f.size / (1024 * 1024)) * 10) / 10,
        }));
        if (chapterErr) throw chapterErr;
      }
      // Update aggregate counts on subject
      const { data: existing } = await supabase
        .from("chapters")
        .select("id")
        .eq("pdf_id", activeSubject.id);
      const { error: pdfErr } = await withSchemaRetry(async () => await supabase.from("pdfs").update({
        total_chapters: existing?.length || valid.length,
        file_size_mb: Math.round((totalSize / (1024 * 1024)) * 10) / 10,
      }).eq("id", activeSubject.id));
      if (pdfErr) throw pdfErr;

      toast.success(`Saved ${valid.length} module${valid.length > 1 ? "s" : ""}`);
      setStep("list");
      setActiveSubject(null);
      setSubjectForm(emptySubject);
      setCoverFile(null);
      reload();
    } catch (e: any) {
      toast.error(e.message || "Module upload failed");
    } finally {
      setBusy(false);
    }
  };

  const toggleVerified = async (p: Subject) => {
    const { error } = await withSchemaRetry(async () => await supabase.from("pdfs").update({ is_verified: !p.is_verified }).eq("id", p.id));
    if (error) { toast.error(getDatabaseErrorMessage(error)); return; }
    reload();
  };

  const remove = async (p: Subject) => {
    if (!confirm(`Delete "${p.title}"? This also removes all its modules.`)) return;
    const chapterDelete = await withSchemaRetry(async () => await supabase.from("chapters").delete().eq("pdf_id", p.id));
    if (chapterDelete.error) { toast.error(getDatabaseErrorMessage(chapterDelete.error)); return; }
    const pdfDelete = await withSchemaRetry(async () => await supabase.from("pdfs").delete().eq("id", p.id));
    if (pdfDelete.error) { toast.error(getDatabaseErrorMessage(pdfDelete.error)); return; }
    toast.success("Subject deleted");
    reload();
  };

  const saveEdit = async () => {
    if (!editing) return;
    const { error } = await withSchemaRetry(async () => await supabase.from("pdfs").update({
      title: editing.title,
      course_code: editing.course_code,
      level: editing.level as any,
      department: editing.department,
      faculty: editing.faculty,
      description: editing.description,
      tags: editing.tags,
      is_verified: editing.is_verified,
    }).eq("id", editing.id));
    if (error) { toast.error(getDatabaseErrorMessage(error)); return; }
    setEditing(null);
    toast.success("Updated");
    reload();
  };

  const filtered = list.filter((p) =>
    !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.course_code.toLowerCase().includes(search.toLowerCase())
  );

  /* ---------- RENDER ---------- */

  if (step === "subject") {
    return (
      <div className="space-y-4">
        <button onClick={() => setStep("list")} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to list
        </button>
        <SectionHeader title="Step 1 — Create Subject" subtitle="Define the course this material belongs to" />
        <div className="surface-card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Subject Title"><input className={inputClass} value={subjectForm.title} onChange={(e) => setSubjectForm({ ...subjectForm, title: e.target.value })} placeholder="Engineering Mathematics I" /></Field>
            <Field label="Course Code"><input className={inputClass} value={subjectForm.course_code} onChange={(e) => setSubjectForm({ ...subjectForm, course_code: e.target.value })} placeholder="MTH 101" /></Field>
            <Field label="Level">
              <select className={inputClass} value={subjectForm.level} onChange={(e) => setSubjectForm({ ...subjectForm, level: e.target.value })}>
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </Field>
            <Field label="Department"><input className={inputClass} value={subjectForm.department} onChange={(e) => setSubjectForm({ ...subjectForm, department: e.target.value })} /></Field>
            <Field label="Faculty"><input className={inputClass} value={subjectForm.faculty} onChange={(e) => setSubjectForm({ ...subjectForm, faculty: e.target.value })} /></Field>
            <Field label="Tags" hint="Comma separated"><input className={inputClass} value={subjectForm.tags} onChange={(e) => setSubjectForm({ ...subjectForm, tags: e.target.value })} placeholder="General Course, Past Q" /></Field>
          </div>
          <Field label="Description (optional)">
            <textarea className={`${inputClass} min-h-[70px]`} value={subjectForm.description} onChange={(e) => setSubjectForm({ ...subjectForm, description: e.target.value })} />
          </Field>
          <Field label="Cover Image — upload or URL">
            <input type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
              className="block w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-border file:bg-surface file:text-foreground file:text-xs mb-2" />
            <input className={inputClass} value={subjectForm.cover_url} onChange={(e) => setSubjectForm({ ...subjectForm, cover_url: e.target.value })} placeholder="https://… (used if no file)" />
          </Field>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={subjectForm.is_verified} onChange={(e) => setSubjectForm({ ...subjectForm, is_verified: e.target.checked })} />
            <span>Mark as Rep Verified</span>
          </label>
          <button disabled={busy} onClick={createSubject} className="w-full bg-gradient-button border border-primary/40 text-primary text-sm font-semibold rounded-lg py-2.5 disabled:opacity-50">
            {busy ? "Creating…" : "Create Subject & Continue →"}
          </button>
        </div>
      </div>
    );
  }

  if (step === "modules" && activeSubject) {
    return (
      <div className="space-y-4">
        <button onClick={() => setStep("list")} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to list
        </button>
        <SectionHeader title="Step 2 — Add Modules / Topics" subtitle="Upload one or more module PDFs under this subject" />

        {/* Subject header */}
        <div className="surface-card p-4 flex items-center gap-3 bg-gradient-cover">
          <div className="h-12 w-10 rounded-md bg-white/10 flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white line-clamp-1">{activeSubject.title}</p>
            <p className="text-[11px] text-white/80">{activeSubject.course_code} · {activeSubject.level}</p>
          </div>
        </div>

        {/* Modules list */}
        <div className="space-y-3">
          {modules.map((m, idx) => (
            <div key={idx} className="surface-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground">Module #{idx + 1}</p>
                {modules.length > 1 && (
                  <button onClick={() => removeModule(idx)} className="text-destructive text-xs inline-flex items-center gap-1">
                    <Trash2 className="h-3 w-3" /> Remove
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Number">
                  <input type="number" min={1} className={inputClass} value={m.module_number}
                    onChange={(e) => updateModule(idx, { module_number: parseInt(e.target.value) || 1 })} />
                </Field>
                <div className="col-span-2">
                  <Field label="Module Title">
                    <input className={inputClass} value={m.module_title}
                      onChange={(e) => updateModule(idx, { module_title: e.target.value })}
                      placeholder="Topic 1: Algebra Fundamentals" />
                  </Field>
                </div>
              </div>
              <Field label="PDF File">
                <input type="file" accept="application/pdf"
                  onChange={(e) => updateModule(idx, { file: e.target.files?.[0] || null })}
                  className="block w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-border file:bg-surface file:text-foreground file:text-xs" />
                {m.file && <p className="text-[10px] text-muted-foreground mt-1">{m.file.name} · {(m.file.size / (1024 * 1024)).toFixed(1)} MB</p>}
              </Field>
            </div>
          ))}

          <button onClick={addModule} className="w-full surface-card border-dashed py-3 text-xs font-semibold text-primary inline-flex items-center justify-center gap-1.5">
            <Plus className="h-4 w-4" /> Add Another Module
          </button>
        </div>

        <div className="flex gap-2">
          <button onClick={() => { setStep("list"); setActiveSubject(null); }} className="flex-1 surface-card py-2.5 text-xs">
            Done for now
          </button>
          <button disabled={busy} onClick={saveAllModules} className="flex-1 bg-gradient-button border border-primary/40 text-primary text-sm font-semibold rounded-lg py-2.5 disabled:opacity-50">
            {busy ? "Saving…" : "Save All Modules"}
          </button>
        </div>
      </div>
    );
  }

  /* default: list view */
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Subjects & Modules"
        subtitle="Create subjects, then upload modules under each"
        right={
          <button
            onClick={() => { setSubjectForm(emptySubject); setCoverFile(null); setStep("subject"); }}
            className="inline-flex items-center gap-1.5 bg-gradient-button border border-primary/40 text-primary text-xs font-semibold rounded-lg px-3 py-2"
          >
            <Upload className="h-3.5 w-3.5" /> New Subject
          </button>
        }
      />

      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold">All subjects ({list.length})</p>
          <input className={`${inputClass} max-w-[200px]`} placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <TableShell>
          <thead><tr>
            <Th>Title</Th><Th>Code</Th><Th>Level</Th><Th>Modules</Th><Th>DLs</Th><Th>Verified</Th><Th>Date</Th><Th>Actions</Th>
          </tr></thead>
          <tbody>
            {filtered.length === 0 ? <EmptyRow cols={8} text="No subjects yet." /> : filtered.map((p) => (
              <tr key={p.id}>
                <Td className="font-medium max-w-[180px] truncate">{p.title}</Td>
                <Td>{p.course_code}</Td>
                <Td>{p.level}</Td>
                <Td>{p.total_chapters}</Td>
                <Td>{p.download_count}</Td>
                <Td>{p.is_verified ? <span className="badge-green">✓</span> : <span className="text-muted-foreground">—</span>}</Td>
                <Td className="text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</Td>
                <Td>
                  <div className="flex gap-1 flex-wrap">
                    <ActionBtn tone="primary" onClick={() => { setActiveSubject(p); setModules([{ module_number: (p.total_chapters || 0) + 1, module_title: "", file: null }]); setStep("modules"); }}>
                      <Plus className="h-3 w-3" /> Module
                    </ActionBtn>
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
            <p className="text-sm font-bold">Edit Subject</p>
            <Field label="Title"><input className={inputClass} value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></Field>
            <Field label="Course code"><input className={inputClass} value={editing.course_code} onChange={(e) => setEditing({ ...editing, course_code: e.target.value })} /></Field>
            <Field label="Level">
              <select className={inputClass} value={editing.level} onChange={(e) => setEditing({ ...editing, level: e.target.value })}>
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </Field>
            <Field label="Department"><input className={inputClass} value={editing.department || ""} onChange={(e) => setEditing({ ...editing, department: e.target.value })} /></Field>
            <Field label="Description"><textarea className={`${inputClass} min-h-[60px]`} value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
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

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Trash2, Pencil, Plus } from "lucide-react";
import { SectionHeader, Field, inputClass, TableShell, Th, Td, ActionBtn, EmptyRow } from "./ui";

const LEVELS = ["100L", "200L", "300L", "400L", "500L"] as const;

interface Ann { id: string; title: string; body: string; target_level: string | null; created_at: string; is_active: boolean; }

export const AdminAnnouncements = () => {
  const { user } = useAuth();
  const [list, setList] = useState<Ann[]>([]);
  const [editing, setEditing] = useState<Ann | null>(null);
  const empty = { title: "", body: "", target_level: "" };
  const [form, setForm] = useState(empty);

  const reload = async () => {
    const { data } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
    setList((data || []) as Ann[]);
  };
  useEffect(() => { reload(); }, []);

  const post = async () => {
    if (!user) return;
    if (!form.title || !form.body) { toast.error("Title and body required"); return; }
    const payload = {
      title: form.title,
      body: form.body,
      target_level: (form.target_level || null) as any,
      created_by: user.id,
    };
    let { error } = await supabase.from("announcements").insert(payload);
    // Transient PostgREST schema-cache error → wait briefly and retry once.
    if (error && ((error as any).code === "PGRST002" || /schema cache/i.test(error.message))) {
      await new Promise((r) => setTimeout(r, 1200));
      ({ error } = await supabase.from("announcements").insert(payload));
    }
    if (error) { toast.error(error.message); return; }
    toast.success("Announcement posted");
    setForm(empty); reload();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete announcement?")) return;
    await supabase.from("announcements").delete().eq("id", id); reload();
  };
  const toggleActive = async (a: Ann) => {
    await supabase.from("announcements").update({ is_active: !a.is_active }).eq("id", a.id); reload();
  };
  const saveEdit = async () => {
    if (!editing) return;
    await supabase.from("announcements").update({
      title: editing.title, body: editing.body,
      target_level: (editing.target_level || null) as any,
      is_active: editing.is_active,
    }).eq("id", editing.id);
    setEditing(null); toast.success("Updated"); reload();
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Announcements" subtitle="Push notices to all students or by level" />

      <div className="surface-card p-4 space-y-3">
        <p className="text-sm font-bold flex items-center gap-2"><Plus className="h-4 w-4 text-primary" /> Post new announcement</p>
        <Field label="Title"><input className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Body"><textarea rows={4} className={inputClass} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Target level">
            <select className={inputClass} value={form.target_level} onChange={(e) => setForm({ ...form, target_level: e.target.value })}>
              <option value="">All students</option>
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </Field>
          <Field label="Post date">
            <input className={inputClass} value={new Date().toLocaleDateString()} disabled />
          </Field>
        </div>
        <button onClick={post} className="w-full bg-gradient-button border border-primary/40 text-primary text-sm font-semibold rounded-lg py-2.5">Post announcement</button>
      </div>

      <div>
        <p className="text-sm font-bold mb-3">Manage ({list.length})</p>
        <TableShell>
          <thead><tr><Th>Title</Th><Th>Level</Th><Th>Date</Th><Th>Active</Th><Th>Actions</Th></tr></thead>
          <tbody>
            {list.length === 0 ? <EmptyRow cols={5} text="No announcements posted yet." /> : list.map((a) => (
              <tr key={a.id} className={a.is_active ? "" : "opacity-50"}>
                <Td className="font-medium max-w-[160px] truncate">{a.title}</Td>
                <Td>{a.target_level || "All"}</Td>
                <Td className="text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</Td>
                <Td>{a.is_active ? <span className="badge-green">ON</span> : <span className="badge-amber">OFF</span>}</Td>
                <Td>
                  <div className="flex gap-1">
                    <ActionBtn onClick={() => setEditing(a)}><Pencil className="h-3 w-3" /></ActionBtn>
                    <ActionBtn tone="primary" onClick={() => toggleActive(a)}>{a.is_active ? "Hide" : "Show"}</ActionBtn>
                    <ActionBtn tone="danger" onClick={() => remove(a.id)}><Trash2 className="h-3 w-3" /></ActionBtn>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="surface-card p-5 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold">Edit announcement</p>
            <Field label="Title"><input className={inputClass} value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></Field>
            <Field label="Body"><textarea rows={4} className={inputClass} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} /></Field>
            <Field label="Target level">
              <select className={inputClass} value={editing.target_level || ""} onChange={(e) => setEditing({ ...editing, target_level: e.target.value || null })}>
                <option value="">All students</option>
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </Field>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} /> Active
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

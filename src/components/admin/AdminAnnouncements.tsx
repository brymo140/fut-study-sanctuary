import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Trash2, Pencil, Plus, Paperclip, X, FileText, Image, Link } from "lucide-react";
import { SectionHeader, Field, inputClass, TableShell, Th, Td, ActionBtn, EmptyRow } from "./ui";
import { getDatabaseErrorMessage, withSchemaRetry } from "@/lib/supabaseRetry";
import { sendPushNotification } from "@/lib/pushNotifications";

const LEVELS = ["100L", "200L", "300L", "400L", "500L"] as const;

interface Ann {
  id: string;
  title: string;
  body: string;
  target_level: string | null;
  created_at: string;
  is_active: boolean;
  attachment_url?: string | null;
  attachment_type?: string | null;
  attachment_name?: string | null;
  link_url?: string | null;
  link_label?: string | null;
}

const emptyForm = {
  title: "",
  body: "",
  target_level: "",
  attachment_url: null as string | null,
  attachment_type: null as string | null,
  attachment_name: null as string | null,
  link_url: "",
  link_label: "",
};

export const AdminAnnouncements = () => {
  const { user } = useAuth();
  const [list, setList] = useState<Ann[]>([]);
  const [editing, setEditing] = useState<Ann | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [uploading, setUploading] = useState(false);
  const [editUploading, setEditUploading] = useState(false);
  const [sendingPush, setSendingPush] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const reload = async () => {
    const { data } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });
    setList((data || []) as Ann[]);
  };

  useEffect(() => { reload(); }, []);

  const uploadAttachment = async (
    file: File,
    onDone: (url: string, type: string, name: string) => void,
    setLoading: (v: boolean) => void
  ) => {
    if (file.size > 10 * 1024 * 1024) { toast.error("File too large. Max 10MB."); return; }
    const isPdf = file.type === "application/pdf";
    const isImage = file.type.startsWith("image/");
    if (!isPdf && !isImage) { toast.error("Only PDF or image files allowed."); return; }

    setLoading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `announcements/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("announcements").upload(path, file, { upsert: false });
      if (uploadErr) { toast.error("Upload failed: " + uploadErr.message); return; }
      const { data: urlData } = supabase.storage.from("announcements").getPublicUrl(path);
      onDone(urlData.publicUrl, isPdf ? "pdf" : "image", file.name);
      toast.success("File attached!");
    } catch { toast.error("Upload failed. Try again."); }
    finally { setLoading(false); }
  };

  const post = async () => {
    if (!user) return;
    if (!form.title || !form.body) { toast.error("Title and body required"); return; }

    const payload: any = {
      title: form.title,
      body: form.body,
      target_level: form.target_level || null,
      created_by: user.id,
    };
    if (form.attachment_url) {
      payload.attachment_url = form.attachment_url;
      payload.attachment_type = form.attachment_type;
      payload.attachment_name = form.attachment_name;
    }
    if (form.link_url?.trim()) {
      payload.link_url = form.link_url.trim();
      payload.link_label = form.link_label?.trim() || "Visit Link";
    }

    const { error } = await withSchemaRetry(async () =>
      await supabase.from("announcements").insert(payload)
    );
    if (error) { toast.error(getDatabaseErrorMessage(error)); return; }

    // Send push to Android users, show in-app indicator for iOS
    setSendingPush(true);
    try {
      // Determine notification URL — feedback page or home
      const notifUrl = form.link_url?.trim()
        ? form.link_url.trim()
        : (form.title.toLowerCase().includes("request") || form.title.toLowerCase().includes("feedback"))
          ? "/feedback"
          : "/";

      await sendPushNotification({
        target_level: form.target_level || null,
        title: `📢 HighVault${form.target_level ? ` · ${form.target_level}` : ""}`,
        body: form.title.slice(0, 80),
        url: notifUrl,
        send_to_all: !form.target_level,
      });
      toast.success("Announcement posted! Push notification sent to Android users.");
    } catch {
      toast.success("Announcement posted! (Push notification may not have reached all users.)");
    } finally {
      setSendingPush(false);
    }

    setForm({ ...emptyForm });
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete announcement?")) return;
    const { error } = await withSchemaRetry(async () =>
      await supabase.from("announcements").delete().eq("id", id)
    );
    if (error) { toast.error(getDatabaseErrorMessage(error)); return; }
    reload();
  };

  const toggleActive = async (a: Ann) => {
    const { error } = await withSchemaRetry(async () =>
      await supabase.from("announcements").update({ is_active: !a.is_active }).eq("id", a.id)
    );
    if (error) { toast.error(getDatabaseErrorMessage(error)); return; }
    reload();
  };

  const saveEdit = async () => {
    if (!editing) return;
    const payload: any = {
      title: editing.title, body: editing.body,
      target_level: editing.target_level || null,
      is_active: editing.is_active,
      attachment_url: editing.attachment_url || null,
      attachment_type: editing.attachment_type || null,
      attachment_name: editing.attachment_name || null,
      link_url: editing.link_url?.trim() || null,
      link_label: editing.link_label?.trim() || null,
    };
    const { error } = await withSchemaRetry(async () =>
      await supabase.from("announcements").update(payload).eq("id", editing.id)
    );
    if (error) { toast.error(getDatabaseErrorMessage(error)); return; }
    setEditing(null); toast.success("Updated"); reload();
  };

  const AttachmentPreview = ({
    url, type, name, onRemove,
  }: { url: string; type: string; name: string; onRemove: () => void }) => (
    <div className="flex items-center gap-2 p-2 bg-muted/40 rounded-lg border border-border">
      {type === "pdf" ? <FileText className="h-4 w-4 text-primary shrink-0" /> : <Image className="h-4 w-4 text-primary shrink-0" />}
      <span className="text-xs flex-1 truncate">{name}</span>
      <button onClick={onRemove}><X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" /></button>
    </div>
  );

  return (
    <div className="space-y-6">
      <SectionHeader title="Announcements" subtitle="Post notices with optional file attachments and links" />

      {/* New announcement form */}
      <div className="surface-card p-4 space-y-3">
        <p className="text-sm font-bold flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" /> Post new announcement
        </p>

        <Field label="Title">
          <input className={inputClass} value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Announcement title..." />
        </Field>

        <Field label="Body">
          <textarea rows={4} className={inputClass} value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            placeholder="Full message..." />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Target level">
            <select className={inputClass} value={form.target_level}
              onChange={(e) => setForm({ ...form, target_level: e.target.value })}>
              <option value="">All students</option>
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </Field>
          <Field label="Post date">
            <input className={inputClass} value={new Date().toLocaleDateString()} disabled />
          </Field>
        </div>

        {/* External link */}
        <Field label="Link URL (optional)">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input 
              className={`${inputClass} pl-8 text-foreground`} value={form.link_url}
              onChange={(e) => setForm({ ...form, link_url: e.target.value })}
              placeholder="https://... or /feedback" 
            />
            </div>
            <input 
            className={`${inputClass} w-28 text-foreground`} value={form.link_label}
            onChange={(e) => setForm({ ...form, link_label: e.target.value })}
            placeholder="Button text" 
          />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Use /feedback to direct students to submit a material request
          </p>
        </Field>

        {/* Attachment */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Attachment (optional)</p>
          {form.attachment_url ? (
            <AttachmentPreview
              url={form.attachment_url} type={form.attachment_type || "pdf"}
              name={form.attachment_name || "Attachment"}
              onRemove={() => setForm({ ...form, attachment_url: null, attachment_type: null, attachment_name: null })}
            />
          ) : (
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded-lg text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors w-full justify-center">
              {uploading ? "Uploading..." : <><Paperclip className="h-3.5 w-3.5" /> Attach PDF or image</>}
            </button>
          )}
          <input ref={fileInputRef} type="file" accept=".pdf,image/*" className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]; if (!file) return;
              uploadAttachment(file,
                (url, type, name) => setForm({ ...form, attachment_url: url, attachment_type: type, attachment_name: name }),
                setUploading);
              e.target.value = "";
            }} />
        </div>

        <button onClick={post} disabled={uploading || sendingPush}
          className="w-full bg-gradient-button border border-primary/40 text-primary text-sm font-semibold rounded-lg py-2.5 disabled:opacity-50">
          {sendingPush ? "Sending announcements..." : "📢 Post announcement."}
        </button>
      </div>

      {/* Table */}
      <div>
        <p className="text-sm font-bold mb-3">Manage ({list.length})</p>
        <TableShell>
          <thead><tr><Th>Title</Th><Th>Level</Th><Th>Link</Th><Th>Date</Th><Th>Active</Th><Th>Actions</Th></tr></thead>
          <tbody>
            {list.length === 0 ? <EmptyRow cols={6} text="No announcements yet." /> : list.map((a) => (
              <tr key={a.id} className={a.is_active ? "" : "opacity-50"}>
                <Td className="font-medium max-w-[140px] truncate">{a.title}</Td>
                <Td>{a.target_level || "All"}</Td>
                <Td>
                  {a.link_url
                    ? <span className="badge-blue text-[10px]">{a.link_label || "Link"}</span>
                    : <span className="text-xs text-muted-foreground">—</span>}
                </Td>
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

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="surface-card p-5 w-full max-w-md space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold">Edit announcement</p>
            <Field label="Title"><input className={inputClass} value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></Field>
            <Field label="Body"><textarea rows={4} className={inputClass} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} /></Field>
            <Field label="Target level">
              <select className={inputClass} value={editing.target_level || ""} onChange={(e) => setEditing({ ...editing, target_level: e.target.value || null })}>
                <option value="">All students</option>
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </Field>
            <Field label="Link URL">
              <input className={inputClass} value={editing.link_url || ""} onChange={(e) => setEditing({ ...editing, link_url: e.target.value })} placeholder="https://... or /feedback" />
            </Field>
            <Field label="Link Button Text">
              <input className={inputClass} value={editing.link_label || ""} onChange={(e) => setEditing({ ...editing, link_label: e.target.value })} placeholder="Visit Link" />
            </Field>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Attachment</p>
              {editing.attachment_url ? (
                <AttachmentPreview url={editing.attachment_url} type={editing.attachment_type || "pdf"}
                  name={editing.attachment_name || "Attachment"}
                  onRemove={() => setEditing({ ...editing, attachment_url: null, attachment_type: null, attachment_name: null })} />
              ) : (
                <button onClick={() => editFileInputRef.current?.click()} disabled={editUploading}
                  className="flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded-lg text-xs text-muted-foreground hover:border-primary w-full justify-center">
                  {editUploading ? "Uploading..." : <><Paperclip className="h-3.5 w-3.5" /> Attach PDF or image</>}
                </button>
              )}
              <input ref={editFileInputRef} type="file" accept=".pdf,image/*" className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]; if (!file) return;
                  uploadAttachment(file, (url, type, name) => setEditing({ ...editing, attachment_url: url, attachment_type: type, attachment_name: name }), setEditUploading);
                  e.target.value = "";
                }} />
            </div>
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

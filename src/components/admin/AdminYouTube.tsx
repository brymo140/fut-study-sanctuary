import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Pencil, Plus } from "lucide-react";
import { SectionHeader, Field, inputClass, TableShell, Th, Td, ActionBtn, EmptyRow } from "./ui";
import { getDatabaseErrorMessage, withSchemaRetry } from "@/lib/supabaseRetry";

const LEVELS = ["100L", "200L", "300L", "400L", "500L"] as const;

interface Channel { id: string; channel_name: string; channel_url: string; description: string | null; level: string | null; course_tags: string[] | null; thumbnail_url: string | null; is_active: boolean; }
interface Video { id: string; video_title: string; video_url: string; thumbnail_url: string | null; course_tag: string | null; level: string | null; is_featured: boolean; }

export const AdminYouTube = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [editingCh, setEditingCh] = useState<Channel | null>(null);
  const [editingVid, setEditingVid] = useState<Video | null>(null);

  const ch0 = { channel_name: "", channel_url: "", description: "", level: "100L", course_tags: "", thumbnail_url: "", is_active: true };
  const v0 = { video_title: "", video_url: "", thumbnail_url: "", course_tag: "", level: "100L", is_featured: true };
  const [chForm, setChForm] = useState(ch0);
  const [vForm, setVForm] = useState(v0);

  const reload = async () => {
    const [{ data: c }, { data: v }] = await Promise.all([
      supabase.from("youtube_channels").select("*").order("created_at", { ascending: false }),
      supabase.from("youtube_videos").select("*").order("created_at", { ascending: false }),
    ]);
    setChannels((c || []) as Channel[]);
    setVideos((v || []) as Video[]);
  };
  useEffect(() => { reload(); }, []);

  const addChannel = async () => {
    if (!chForm.channel_name || !chForm.channel_url) { toast.error("Name and URL required"); return; }
    const tags = chForm.course_tags.split(",").map((t) => t.trim()).filter(Boolean);
    const { error } = await withSchemaRetry(async () => await supabase.from("youtube_channels").insert({
      channel_name: chForm.channel_name,
      channel_url: chForm.channel_url,
      description: chForm.description || null,
      level: (chForm.level || null) as any,
      course_tags: tags,
      thumbnail_url: chForm.thumbnail_url || null,
      is_active: chForm.is_active,
    }));
    if (error) { toast.error(getDatabaseErrorMessage(error)); return; }
    toast.success("Channel added");
    setChForm(ch0); reload();
  };

  const addVideo = async () => {
    if (!vForm.video_title || !vForm.video_url) { toast.error("Title and URL required"); return; }
    const { error } = await withSchemaRetry(async () => await supabase.from("youtube_videos").insert({
      video_title: vForm.video_title,
      video_url: vForm.video_url,
      thumbnail_url: vForm.thumbnail_url || null,
      course_tag: vForm.course_tag || null,
      level: (vForm.level || null) as any,
      is_featured: vForm.is_featured,
    }));
    if (error) { toast.error(getDatabaseErrorMessage(error)); return; }
    toast.success("Video added");
    setVForm(v0); reload();
  };

  const delChannel = async (id: string) => {
    if (!confirm("Delete this channel?")) return;
    const { error } = await withSchemaRetry(async () => await supabase.from("youtube_channels").delete().eq("id", id));
    if (error) { toast.error(getDatabaseErrorMessage(error)); return; }
    reload();
  };
  const delVideo = async (id: string) => {
    if (!confirm("Delete this video?")) return;
    const { error } = await withSchemaRetry(async () => await supabase.from("youtube_videos").delete().eq("id", id));
    if (error) { toast.error(getDatabaseErrorMessage(error)); return; }
    reload();
  };
  const toggleChActive = async (c: Channel) => {
    const { error } = await withSchemaRetry(async () => await supabase.from("youtube_channels").update({ is_active: !c.is_active }).eq("id", c.id));
    if (error) { toast.error(getDatabaseErrorMessage(error)); return; }
    reload();
  };
  const toggleVidFeat = async (v: Video) => {
    const { error } = await withSchemaRetry(async () => await supabase.from("youtube_videos").update({ is_featured: !v.is_featured }).eq("id", v.id));
    if (error) { toast.error(getDatabaseErrorMessage(error)); return; }
    reload();
  };

  const saveEditCh = async () => {
    if (!editingCh) return;
    const { id, ...rest } = editingCh;
    const { error } = await withSchemaRetry(async () => await supabase.from("youtube_channels").update(rest as any).eq("id", id));
    if (error) { toast.error(getDatabaseErrorMessage(error)); return; }
    setEditingCh(null); toast.success("Updated"); reload();
  };
  const saveEditVid = async () => {
    if (!editingVid) return;
    const { id, ...rest } = editingVid;
    const { error } = await withSchemaRetry(async () => await supabase.from("youtube_videos").update(rest as any).eq("id", id));
    if (error) { toast.error(getDatabaseErrorMessage(error)); return; }
    setEditingVid(null); toast.success("Updated"); reload();
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="YouTube Hub" subtitle="Curate learning channels and featured videos" />

      {/* Add channel */}
      <div className="surface-card p-4 space-y-3">
        <p className="text-sm font-bold flex items-center gap-2"><Plus className="h-4 w-4 text-primary" /> Add channel</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Channel name"><input className={inputClass} value={chForm.channel_name} onChange={(e) => setChForm({ ...chForm, channel_name: e.target.value })} /></Field>
          <Field label="Channel URL"><input className={inputClass} value={chForm.channel_url} onChange={(e) => setChForm({ ...chForm, channel_url: e.target.value })} placeholder="https://youtube.com/@…" /></Field>
          <Field label="Target level">
            <select className={inputClass} value={chForm.level} onChange={(e) => setChForm({ ...chForm, level: e.target.value })}>
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              <option value="">All levels</option>
            </select>
          </Field>
          <Field label="Course tags" hint="Comma separated"><input className={inputClass} value={chForm.course_tags} onChange={(e) => setChForm({ ...chForm, course_tags: e.target.value })} /></Field>
          <Field label="Thumbnail URL"><input className={inputClass} value={chForm.thumbnail_url} onChange={(e) => setChForm({ ...chForm, thumbnail_url: e.target.value })} /></Field>
          <Field label="Active">
            <label className="flex items-center gap-2 text-xs h-9">
              <input type="checkbox" checked={chForm.is_active} onChange={(e) => setChForm({ ...chForm, is_active: e.target.checked })} /> Visible to students
            </label>
          </Field>
        </div>
        <Field label="Description"><textarea className={inputClass} rows={2} value={chForm.description} onChange={(e) => setChForm({ ...chForm, description: e.target.value })} /></Field>
        <button onClick={addChannel} className="w-full bg-gradient-button border border-primary/40 text-primary text-sm font-semibold rounded-lg py-2.5">Add channel</button>
      </div>

      {/* Add video */}
      <div className="surface-card p-4 space-y-3">
        <p className="text-sm font-bold flex items-center gap-2"><Plus className="h-4 w-4 text-secondary" /> Add featured video</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Video title"><input className={inputClass} value={vForm.video_title} onChange={(e) => setVForm({ ...vForm, video_title: e.target.value })} /></Field>
          <Field label="Video URL"><input className={inputClass} value={vForm.video_url} onChange={(e) => setVForm({ ...vForm, video_url: e.target.value })} /></Field>
          <Field label="Thumbnail URL"><input className={inputClass} value={vForm.thumbnail_url} onChange={(e) => setVForm({ ...vForm, thumbnail_url: e.target.value })} /></Field>
          <Field label="Course tag"><input className={inputClass} value={vForm.course_tag} onChange={(e) => setVForm({ ...vForm, course_tag: e.target.value })} /></Field>
          <Field label="Target level">
            <select className={inputClass} value={vForm.level} onChange={(e) => setVForm({ ...vForm, level: e.target.value })}>
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              <option value="">All levels</option>
            </select>
          </Field>
          <Field label="Featured">
            <label className="flex items-center gap-2 text-xs h-9">
              <input type="checkbox" checked={vForm.is_featured} onChange={(e) => setVForm({ ...vForm, is_featured: e.target.checked })} /> Show on home
            </label>
          </Field>
        </div>
        <button onClick={addVideo} className="w-full bg-gradient-button border border-primary/40 text-primary text-sm font-semibold rounded-lg py-2.5">Add video</button>
      </div>

      {/* Channels table */}
      <div>
        <p className="text-sm font-bold mb-3">Channels ({channels.length})</p>
        <TableShell>
          <thead><tr><Th>Name</Th><Th>Level</Th><Th>URL</Th><Th>Active</Th><Th>Actions</Th></tr></thead>
          <tbody>
            {channels.length === 0 ? <EmptyRow cols={5} text="No channels yet." /> : channels.map((c) => (
              <tr key={c.id}>
                <Td className="font-medium">{c.channel_name}</Td>
                <Td>{c.level || "All"}</Td>
                <Td className="max-w-[140px] truncate"><a className="text-primary" href={c.channel_url} target="_blank" rel="noreferrer">{c.channel_url}</a></Td>
                <Td>{c.is_active ? <span className="badge-green">ON</span> : <span className="badge-amber">OFF</span>}</Td>
                <Td>
                  <div className="flex gap-1">
                    <ActionBtn onClick={() => setEditingCh(c)}><Pencil className="h-3 w-3" /></ActionBtn>
                    <ActionBtn tone="primary" onClick={() => toggleChActive(c)}>{c.is_active ? "Hide" : "Show"}</ActionBtn>
                    <ActionBtn tone="danger" onClick={() => delChannel(c.id)}><Trash2 className="h-3 w-3" /></ActionBtn>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      </div>

      {/* Videos table */}
      <div>
        <p className="text-sm font-bold mb-3">Videos ({videos.length})</p>
        <TableShell>
          <thead><tr><Th>Title</Th><Th>Level</Th><Th>Featured</Th><Th>Actions</Th></tr></thead>
          <tbody>
            {videos.length === 0 ? <EmptyRow cols={4} text="No videos yet." /> : videos.map((v) => (
              <tr key={v.id}>
                <Td className="font-medium max-w-[160px] truncate">{v.video_title}</Td>
                <Td>{v.level || "All"}</Td>
                <Td>{v.is_featured ? <span className="badge-purple">FEAT</span> : <span className="text-muted-foreground">—</span>}</Td>
                <Td>
                  <div className="flex gap-1">
                    <ActionBtn onClick={() => setEditingVid(v)}><Pencil className="h-3 w-3" /></ActionBtn>
                    <ActionBtn tone="primary" onClick={() => toggleVidFeat(v)}>{v.is_featured ? "Unfeat" : "Feat"}</ActionBtn>
                    <ActionBtn tone="danger" onClick={() => delVideo(v.id)}><Trash2 className="h-3 w-3" /></ActionBtn>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      </div>

      {/* Edit channel modal */}
      {editingCh && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setEditingCh(null)}>
          <div className="surface-card p-5 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold">Edit channel</p>
            <Field label="Name"><input className={inputClass} value={editingCh.channel_name} onChange={(e) => setEditingCh({ ...editingCh, channel_name: e.target.value })} /></Field>
            <Field label="URL"><input className={inputClass} value={editingCh.channel_url} onChange={(e) => setEditingCh({ ...editingCh, channel_url: e.target.value })} /></Field>
            <Field label="Thumbnail URL"><input className={inputClass} value={editingCh.thumbnail_url || ""} onChange={(e) => setEditingCh({ ...editingCh, thumbnail_url: e.target.value })} /></Field>
            <Field label="Level">
              <select className={inputClass} value={editingCh.level || ""} onChange={(e) => setEditingCh({ ...editingCh, level: e.target.value || null })}>
                <option value="">All levels</option>
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </Field>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditingCh(null)} className="flex-1 surface-card py-2 text-xs">Cancel</button>
              <button onClick={saveEditCh} className="flex-1 bg-gradient-button border border-primary/40 text-primary py-2 text-xs font-semibold rounded-lg">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit video modal */}
      {editingVid && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setEditingVid(null)}>
          <div className="surface-card p-5 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold">Edit video</p>
            <Field label="Title"><input className={inputClass} value={editingVid.video_title} onChange={(e) => setEditingVid({ ...editingVid, video_title: e.target.value })} /></Field>
            <Field label="URL"><input className={inputClass} value={editingVid.video_url} onChange={(e) => setEditingVid({ ...editingVid, video_url: e.target.value })} /></Field>
            <Field label="Thumbnail URL"><input className={inputClass} value={editingVid.thumbnail_url || ""} onChange={(e) => setEditingVid({ ...editingVid, thumbnail_url: e.target.value })} /></Field>
            <Field label="Course tag"><input className={inputClass} value={editingVid.course_tag || ""} onChange={(e) => setEditingVid({ ...editingVid, course_tag: e.target.value })} /></Field>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditingVid(null)} className="flex-1 surface-card py-2 text-xs">Cancel</button>
              <button onClick={saveEditVid} className="flex-1 bg-gradient-button border border-primary/40 text-primary py-2 text-xs font-semibold rounded-lg">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

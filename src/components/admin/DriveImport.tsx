import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Field, inputClass } from "./ui";
import {
  FolderOpen, Link2, Download, CheckSquare, Square,
  Loader2, ChevronDown, ChevronUp, AlertCircle, Check,
  Folder, FileText, ToggleLeft, ToggleRight, X
} from "lucide-react";

const DRIVE_API_KEY = import.meta.env.VITE_GOOGLE_DRIVE_API_KEY as string;
const LEVELS = ["100L", "200L", "300L", "400L", "500L"] as const;

// ─── Types ────────────────────────────────────────────────────────────────────
interface DriveFile {
  id: string;
  name: string;
  size?: string;
  mimeType: string;
}

interface DriveFolder {
  id: string;
  name: string;
}

// One ImportGroup = one pdfs row + N chapters (when isRelated: true)
//                or N separate pdfs rows, one per file (when isRelated: false)
interface ImportGroup {
  folderId: string | null;
  folderName: string;
  files: DriveFile[];
  selectedIds: Set<string>;
  subjectTitle: string;
  courseCode: string;
  level: string;
  enabled: boolean;
  isPastQuestion: boolean;
  isRelated: boolean;
  isVerified: boolean;
  fileMetadata: Record<string, { title: string; courseCode: string }>;
}

type DriveTarget =
  | { kind: "file"; id: string }
  | { kind: "folder"; id: string }
  | null;

// ─── Drive link parser ────────────────────────────────────────────────────────
const parseDriveLink = (url: string): DriveTarget => {
  try {
    const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch) return { kind: "file", id: fileMatch[1] };
    const folderMatch = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (folderMatch) return { kind: "folder", id: folderMatch[1] };
    const openMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (openMatch) return { kind: "file", id: openMatch[1] };
  } catch {}
  return null;
};

// ─── Drive API helpers (listing only — no file downloads from browser) ────────
const driveGetFile = async (fileId: string): Promise<DriveFile | null> => {
  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?key=${DRIVE_API_KEY}&fields=id,name,size,mimeType`
  );
  if (!resp.ok) return null;
  return resp.json();
};

const listDirectPdfs = async (folderId: string): Promise<DriveFile[]> => {
  const results: DriveFile[] = [];
  let pageToken = "";
  do {
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("key", DRIVE_API_KEY);
    url.searchParams.set("q", `'${folderId}' in parents and mimeType='application/pdf' and trashed=false`);
    url.searchParams.set("fields", "nextPageToken,files(id,name,size,mimeType)");
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const resp = await fetch(url.toString());
    if (!resp.ok) break;
    const data = await resp.json();
    results.push(...(data.files || []));
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  return results;
};

const listDirectSubfolders = async (folderId: string): Promise<DriveFolder[]> => {
  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files?key=${DRIVE_API_KEY}` +
    `&q='${folderId}'+in+parents+and+mimeType='application/vnd.google-apps.folder'+and+trashed=false` +
    `&fields=files(id,name)&pageSize=50`
  );
  if (!resp.ok) return [];
  const data = await resp.json();
  return data.files || [];
};

const formatSize = (bytes?: string) => {
  if (!bytes) return "—";
  const mb = parseInt(bytes) / (1024 * 1024);
  return mb < 1 ? `${Math.round(mb * 1024)} KB` : `${mb.toFixed(1)} MB`;
};

const cleanTitle = (name: string) =>
  name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").replace(/\s{2,}/g, " ").trim();

const COURSE_CODE_PATTERN = /\b([A-Za-z]{2,4})[\s_-]?(\d{2,4})\b/;

const extractTitleAndCode = (rawName: string): { title: string; courseCode: string } => {
  const cleaned = cleanTitle(rawName);
  const match = cleaned.match(COURSE_CODE_PATTERN);

  if (!match) {
    return { title: cleaned, courseCode: "" };
  }

  const courseCode = `${match[1].toUpperCase()}${match[2]}`;

  const titleWithoutCode = cleaned
    .slice(0, match.index) + cleaned.slice((match.index ?? 0) + match[0].length);

  const title = titleWithoutCode
    .replace(/^[\s,:.\-]+/, "")   
    .replace(/[\s,:.\-]+$/, "")   
    .replace(/\s{2,}/g, " ")
    .trim();

  return {
    courseCode,
    title: title.length >= 3 ? title : cleaned,
  };
};

const buildFileMetadata = (files: DriveFile[]): Record<string, { title: string; courseCode: string }> => {
  const map: Record<string, { title: string; courseCode: string }> = {};
  for (const f of files) {
    map[f.id] = extractTitleAndCode(f.name);
  }
  return map;
};

const detectsPastQuestion = (name: string): boolean => {
  const lower = name.toLowerCase();
  return (
    lower.includes("past") ||
    lower.includes("past question") ||
    lower.includes("past_question") ||
    lower.includes("pastquestion") ||
    lower.includes("exam") ||
    lower.includes("examination") ||
    lower.includes("previous") ||
    lower.includes("old question") ||
    lower.includes("past exam")
  );
};

const importGroupViaEdgeFunction = async (
  pdfId: string,
  files: DriveFile[],
  startingChapter: number,
  onFileComplete: (fileName: string, success: boolean, error?: string) => void
): Promise<{ success: number; failed: number }> => {

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Not authenticated");

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/drive-import`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        pdf_id: pdfId,
        files: files.map(f => ({ id: f.id, name: f.name, size: f.size })),
        starting_chapter: startingChapter,
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Edge Function error: ${errText}`);
  }

  const result = await response.json();

  if (Array.isArray(result.results)) {
    for (const r of result.results) {
      onFileComplete(r.name, r.success, r.error);
    }
  }

  return { success: result.success || 0, failed: result.failed || 0 };
};

export const DriveImport = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(true);
  const [link, setLink] = useState("");
  const [fetching, setFetching] = useState(false);
  const [mode, setMode] = useState<"flat" | "grouped">("flat");
  const [hasSubfolders, setHasSubfolders] = useState(false);
  const [groups, setGroups] = useState<ImportGroup[]>([]);
  const [importing, setImporting] = useState(false);
  const [defaultLevel, setDefaultLevel] = useState("100L");

  const [fileStatus, setFileStatus] = useState<Record<string, "pending" | "done" | "failed">>({});
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<{ success: number; failed: number } | null>(null);

  const handleFetch = async () => {
    if (!link.trim()) { toast.error("Paste a Google Drive link first"); return; }
    const target = parseDriveLink(link.trim());
    if (!target) { toast.error("Couldn't recognise that Drive link"); return; }
    setFetching(true);
    setGroups([]);
    setFileStatus({});
    setImportSummary(null);

    try {
      if (target.kind === "file") {
        const file = await driveGetFile(target.id);
        if (!file) throw new Error("File not found — make sure it is shared publicly");
        if (file.mimeType !== "application/pdf") throw new Error("That link is not a PDF");
        setHasSubfolders(false);
        setMode("flat");
        setGroups([{
          folderId: null,
          folderName: cleanTitle(file.name),
          files: [file],
          selectedIds: new Set([file.id]),
          subjectTitle: cleanTitle(file.name),
          courseCode: "",
          level: defaultLevel,
          enabled: true,
          isPastQuestion: detectsPastQuestion(file.name),
          isRelated: true, // single file — naturally one subject
          fileMetadata: buildFileMetadata([file]),
          isVerified: false,
        }]);

      } else {
        const [directPdfs, subfolders] = await Promise.all([
          listDirectPdfs(target.id),
          listDirectSubfolders(target.id),
        ]);

        if (subfolders.length === 0) {
          // Flat folder — no subfolders
          if (directPdfs.length === 0) throw new Error("No PDFs found — is the folder shared publicly?");
          setHasSubfolders(false);
          setMode("flat");
          setGroups([{
            folderId: target.id,
            folderName: "Imported Materials",
            files: directPdfs,
            selectedIds: new Set(directPdfs.map(f => f.id)),
            subjectTitle: "",
            courseCode: "",
            level: defaultLevel,
            enabled: true,
            isPastQuestion: false,
            isRelated: false,
            fileMetadata: buildFileMetadata(directPdfs),
            isVerified: false,
          }]);
        } else {
          setHasSubfolders(true);
          setMode("grouped");

          const subgroupResults = await Promise.all(
            subfolders.map(async (sf) => {
              const pdfs = await listDirectPdfs(sf.id);
              // One level deeper
              const subsubs = await listDirectSubfolders(sf.id);
              const deeper = await Promise.all(subsubs.map(ss => listDirectPdfs(ss.id)));
              return { folder: sf, files: [...pdfs, ...deeper.flat()] };
            })
          );

          const newGroups: ImportGroup[] = [];

          // Root-level PDFs as their own group if any
          if (directPdfs.length > 0) {
            newGroups.push({
              folderId: target.id,
              folderName: "Root folder PDFs",
              files: directPdfs,
              selectedIds: new Set(directPdfs.map(f => f.id)),
              subjectTitle: "",
              courseCode: "",
              level: defaultLevel,
              enabled: true,
              isPastQuestion: false,
              isRelated: false, // root-level loose files — likely unrelated
              fileMetadata: buildFileMetadata(directPdfs),
              isVerified: false,
            });
          }

          for (const { folder, files } of subgroupResults) {
            if (files.length === 0) continue;
            newGroups.push({
              folderId: folder.id,
              folderName: folder.name,
              files,
              selectedIds: new Set(files.map(f => f.id)),
              subjectTitle: folder.name,
              courseCode: "",
              level: defaultLevel,
              enabled: true,
              isPastQuestion: detectsPastQuestion(folder.name),
              // A named subfolder usually IS one subject's chapters (e.g. "MTH201/")
              isRelated: true,
              fileMetadata: buildFileMetadata(files),
              isVerified: false,
            });
          }

          if (newGroups.length === 0) throw new Error("No PDFs found in any subfolder");
          setGroups(newGroups);
        }
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to fetch from Drive");
    } finally {
      setFetching(false);
    }
  };

  const switchMode = async (newMode: "flat" | "grouped") => {
    if (newMode === mode) return;
    setMode(newMode);
    setGroups([]);
    toast.info(`Switched to ${newMode === "grouped" ? "one subject per subfolder" : "single subject"} — tap Fetch again`);
  };

  const updateGroup = (index: number, patch: Partial<ImportGroup>) => {
    setGroups(prev => prev.map((g, i) => i === index ? { ...g, ...patch } : g));
  };

  // Update a single file's title or course code (only used in unrelated mode)
  const updateFileMetadata = (groupIndex: number, fileId: string, patch: Partial<{ title: string; courseCode: string }>) => {
    setGroups(prev => prev.map((g, i) => {
      if (i !== groupIndex) return g;
      return {
        ...g,
        fileMetadata: {
          ...g.fileMetadata,
          [fileId]: { ...g.fileMetadata[fileId], ...patch },
        },
      };
    }));
  };

  const toggleFile = (groupIndex: number, fileId: string) => {
    setGroups(prev => prev.map((g, i) => {
      if (i !== groupIndex) return g;
      const next = new Set(g.selectedIds);
      next.has(fileId) ? next.delete(fileId) : next.add(fileId);
      return { ...g, selectedIds: next };
    }));
  };

  const toggleAllInGroup = (groupIndex: number) => {
    setGroups(prev => prev.map((g, i) => {
      if (i !== groupIndex) return g;
      const allSelected = g.selectedIds.size === g.files.length;
      return { ...g, selectedIds: allSelected ? new Set() : new Set(g.files.map(f => f.id)) };
    }));
  };

  const handleImport = async () => {
    if (!user) return;
    const activeGroups = groups.filter(g => g.enabled && g.selectedIds.size > 0);
    if (activeGroups.length === 0) { toast.error("No files selected"); return; }

    // Validation differs by mode:
    // - Related (modular): needs ONE shared Subject Title + Course Code for the group
    // - Unrelated (standalone): EACH selected file needs its OWN title + course code
    const missingShared = activeGroups.find(g => g.isRelated && (!g.subjectTitle.trim() || !g.courseCode.trim()));
    if (missingShared) {
      toast.error(`Fill Subject Title and Course Code for "${missingShared.folderName}"`);
      return;
    }

    for (const g of activeGroups) {
      if (g.isRelated) continue;
      const selectedFiles = g.files.filter(f => g.selectedIds.has(f.id));
      const incomplete = selectedFiles.find(f => {
        const meta = g.fileMetadata[f.id];
        return !meta?.title?.trim() || !meta?.courseCode?.trim();
      });
      if (incomplete) {
        toast.error(`Fill in Title and Course Code for "${incomplete.name}"`);
        return;
      }
    }

    setImporting(true);
    setImportSummary(null);

    const initialStatus: Record<string, "pending" | "done" | "failed"> = {};
    for (const g of activeGroups) {
      for (const id of g.selectedIds) initialStatus[id] = "pending";
    }
    setFileStatus(initialStatus);

    let totalSuccess = 0;
    let totalFailed = 0;

    for (const group of activeGroups) {
      const selectedFiles = group.files.filter(f => group.selectedIds.has(f.id));

      if (group.isRelated) {
        // ── MODULAR MODE: one subject, all selected files become its chapters ──
        const { data: pdfRow, error: pdfErr } = await supabase
          .from("pdfs")
          .insert({
            title: group.subjectTitle.trim(),
            course_code: group.courseCode.trim().toUpperCase(),
            level: group.level as any,
            department: null, faculty: null, description: null, cover_url: null,
            tags: [], is_verified: group.isVerified,
            is_general: false,
            is_past_question: group.isPastQuestion,
            total_chapters: 0,
            uploader_id: user.id,
          })
          .select().single();

        if (pdfErr) {
          toast.error(`Could not create subject "${group.subjectTitle}": ${pdfErr.message}`);
          markFilesFailed(group.selectedIds);
          totalFailed += group.selectedIds.size;
          continue;
        }

        try {
          const { success, failed } = await importGroupViaEdgeFunction(
            pdfRow.id, selectedFiles, 1,
            (fileName, success, error) => {
              const file = selectedFiles.find(f => f.name === fileName);
              if (file) {
                setCurrentFile(success ? null : fileName);
                setFileStatus(prev => ({ ...prev, [file.id]: success ? "done" : "failed" }));
              }
              if (error) console.warn(`[DriveImport] ${fileName}: ${error}`);
            }
          );
          totalSuccess += success;
          totalFailed += failed;
          if (success === 0) await supabase.from("pdfs").delete().eq("id", pdfRow.id);
        } catch (e: any) {
          toast.error(`"${group.subjectTitle}" failed: ${e.message}`);
          markFilesFailed(group.selectedIds);
          totalFailed += group.selectedIds.size;
          await supabase.from("pdfs").delete().eq("id", pdfRow.id);
        }

      } else {
        // ── STANDALONE MODE: each file becomes its OWN subject (is_general: true) ──
        // Title and course code come from each file's OWN metadata — they are
        // genuinely unrelated files, so neither can share one course code.
        for (const file of selectedFiles) {
          setCurrentFile(file.name);
          const meta = group.fileMetadata[file.id];

          const { data: pdfRow, error: pdfErr } = await supabase
            .from("pdfs")
            .insert({
              title: meta.title.trim(),
              course_code: meta.courseCode.trim().toUpperCase(),
              level: group.level as any,
              department: null, faculty: null, description: null, cover_url: null,
              tags: [], is_verified: group.isVerified,
              is_general: true,
              is_past_question: group.isPastQuestion,
              total_chapters: 0,
              uploader_id: user.id,
            })
            .select().single();

          if (pdfErr) {
            toast.error(`Could not create subject for "${file.name}": ${pdfErr.message}`);
            setFileStatus(prev => ({ ...prev, [file.id]: "failed" }));
            totalFailed++;
            continue;
          }

          try {
            const { success, failed } = await importGroupViaEdgeFunction(
              pdfRow.id, [file], 1,
              (fileName, success, error) => {
                setFileStatus(prev => ({ ...prev, [file.id]: success ? "done" : "failed" }));
                if (error) console.warn(`[DriveImport] ${fileName}: ${error}`);
              }
            );
            totalSuccess += success;
            totalFailed += failed;
            if (success === 0) await supabase.from("pdfs").delete().eq("id", pdfRow.id);
          } catch (e: any) {
            toast.error(`"${file.name}" failed: ${e.message}`);
            setFileStatus(prev => ({ ...prev, [file.id]: "failed" }));
            totalFailed++;
            await supabase.from("pdfs").delete().eq("id", pdfRow.id);
          }
        }
      }
    }

    setCurrentFile(null);
    setImporting(false);
    setImportSummary({ success: totalSuccess, failed: totalFailed });

    if (totalSuccess > 0) {
      toast.success(`✅ Imported ${totalSuccess} PDF${totalSuccess !== 1 ? "s" : ""} successfully`);
    }
    if (totalFailed > 0) {
      toast.warning(`${totalFailed} file${totalFailed !== 1 ? "s" : ""} failed — see results below`);
    }
  };

  // Helper: mark a set of file IDs as failed in the status map
  const markFilesFailed = (ids: Set<string>) => {
    setFileStatus(prev => {
      const next = { ...prev };
      ids.forEach(id => { next[id] = "failed"; });
      return next;
    });
  };


  const resetAll = () => {
    setLink("");
    setGroups([]);
    setFileStatus({});
    setImportSummary(null);
    setCurrentFile(null);
    setHasSubfolders(false);
  };

  const totalSelected = groups.filter(g => g.enabled).reduce((acc, g) => acc + g.selectedIds.size, 0);
  const activeGroups = groups.filter(g => g.enabled && g.selectedIds.size > 0);

  if (!DRIVE_API_KEY) {
    return (
      <div className="surface-card p-4 border border-amber-500/30 bg-amber-500/5 rounded-xl text-sm text-amber-600 flex gap-2 items-start">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          <strong>VITE_GOOGLE_DRIVE_API_KEY</strong> is not set. Add it to your{" "}
          <code>.env</code> file and Netlify environment variables.
        </span>
      </div>
    );
  }

  return (
    <div className="surface-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-elevated transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <FolderOpen className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold">Import from Google Drive</p>
            <p className="text-[11px] text-muted-foreground">Single file · flat folder · multi-subject folder</p>
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-5 pt-2 space-y-4 border-t border-border">

          {/* Sharing warning */}
          <div className="flex gap-2 items-start bg-amber-500/8 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-600">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>The Drive link must be <strong>"Anyone with the link can view"</strong>. Private links will not work.</span>
          </div>

          {/* Link input + default level */}
          <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
            <Field label="Google Drive link">
              <div className="relative">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <input
                  className={`${inputClass} pl-8 text-foreground`}
                  value={link}
                  onChange={e => setLink(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                  disabled={importing}
                />
              </div>
            </Field>
            <Field label="Default level">
              <select
                className={`${inputClass} text-foreground`}
                value={defaultLevel}
                onChange={e => setDefaultLevel(e.target.value)}
                disabled={importing}
              >
                {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </Field>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleFetch}
              disabled={fetching || importing || !link.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
            >
              {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {fetching ? "Scanning Drive…" : "Fetch files"}
            </button>
            {groups.length > 0 && (
              <button
                onClick={resetAll}
                disabled={importing}
                className="flex items-center gap-2 px-3 py-2 border border-border text-muted-foreground text-sm rounded-lg hover:bg-surface-elevated disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            )}
          </div>

          {/* Mode switcher */}
          {hasSubfolders && groups.length > 0 && (
            <div className="flex items-center gap-3 p-3 bg-surface-elevated rounded-xl border border-border">
              <div className="flex-1">
                <p className="text-xs font-semibold">Subfolders detected</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {mode === "grouped"
                    ? "Each subfolder becomes its own subject — recommended"
                    : "All PDFs merged into one single subject"
                  }
                </p>
              </div>
              <button
                onClick={() => switchMode(mode === "grouped" ? "flat" : "grouped")}
                disabled={importing}
                className="flex items-center gap-1.5 text-xs text-primary font-semibold"
              >
                {mode === "grouped"
                  ? <ToggleRight className="h-5 w-5 text-primary" />
                  : <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                }
                {mode === "grouped" ? "Grouped" : "Flat"}
              </button>
            </div>
          )}

          {/* ── Review section — one card per group ── */}
          {groups.map((group, gi) => (
            <div
              key={gi}
              className={`border rounded-xl overflow-hidden transition-opacity ${group.enabled ? "border-border" : "border-border/30 opacity-40"}`}
            >
              {/* Group header */}
              <div className="flex items-center gap-2.5 px-3 py-2.5 bg-surface-elevated">
                {groups.length > 1 && (
                  <button
                    onClick={() => updateGroup(gi, { enabled: !group.enabled })}
                    disabled={importing}
                  >
                    {group.enabled
                      ? <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                      : <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                    }
                  </button>
                )}
                <Folder className="h-4 w-4 text-blue-400 shrink-0" />
                <p className="text-xs font-bold flex-1 truncate">{group.folderName}</p>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {group.selectedIds.size}/{group.files.length} selected
                </span>
              </div>

              {group.enabled && (
                <div className="p-3 space-y-3">

                  {/* File checklist */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                        Files to import
                      </p>
                      <button
                        onClick={() => toggleAllInGroup(gi)}
                        disabled={importing}
                        className="text-[10px] text-primary underline underline-offset-2"
                      >
                        {group.selectedIds.size === group.files.length ? "Deselect all" : "Select all"}
                      </button>
                    </div>
                    <div className="max-h-72 overflow-y-auto space-y-1 border border-border rounded-lg p-1.5">
                      {group.files.map(f => {
                        const status = fileStatus[f.id];
                        const isSel = group.selectedIds.has(f.id);
                        const meta = group.fileMetadata[f.id];
                        return (
                          <div
                            key={f.id}
                            className={`rounded-lg transition-colors ${isSel && !status ? "bg-primary/8" : ""} ${status === "done" ? "opacity-60" : ""}`}
                          >
                            <button
                              onClick={() => !importing && toggleFile(gi, f.id)}
                              disabled={importing}
                              className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-surface-elevated rounded-lg"
                            >
                              {/* Status icon */}
                              {status === "done" && <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />}
                              {status === "failed" && <X className="h-3.5 w-3.5 text-destructive shrink-0" />}
                              {status === "pending" && <Loader2 className="h-3.5 w-3.5 text-primary animate-spin shrink-0" />}
                              {!status && (isSel
                                ? <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" />
                                : <Square className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              )}
                              <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className={`flex-1 text-[11px] font-medium line-clamp-1 ${status === "failed" ? "text-destructive" : ""}`}>
                                {f.name}
                              </span>
                              <span className="text-[10px] text-muted-foreground shrink-0">{formatSize(f.size)}</span>
                            </button>

                            {/* Per-file Title + Course Code — only in unrelated/standalone mode,
                                and only for selected files (no point editing a file you won't import) */}
                            {!group.isRelated && isSel && !status && (
                              <div className="grid grid-cols-2 gap-1.5 px-2 pb-2 pt-0.5">
                                <input
                                  className={`${inputClass} text-foreground text-[11px] py-1.5`}
                                  value={meta?.title || ""}
                                  onChange={e => updateFileMetadata(gi, f.id, { title: e.target.value })}
                                  placeholder="Subject title"
                                  disabled={importing}
                                />
                                <input
                                  className={`${inputClass} text-foreground text-[11px] py-1.5`}
                                  value={meta?.courseCode || ""}
                                  onChange={e => updateFileMetadata(gi, f.id, { courseCode: e.target.value })}
                                  placeholder="Course code"
                                  disabled={importing}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {!group.isRelated && (
                    <p className="text-[10px] text-amber-500/80 -mt-1 flex items-start gap-1">
                      <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                      Titles and course codes are guessed from filenames — check each one above before importing.
                    </p>
                  )}

                  {/* ── Related vs Standalone toggle ── */}
                  <button
                    onClick={() => updateGroup(gi, { isRelated: !group.isRelated })}
                    disabled={importing}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                      group.isRelated
                        ? "bg-primary/8 border-primary/30"
                        : "bg-surface border-border"
                    }`}
                  >
                    {group.isRelated
                      ? <ToggleRight className="h-5 w-5 text-primary shrink-0" />
                      : <ToggleLeft className="h-5 w-5 text-muted-foreground shrink-0" />
                    }
                    <div className="flex-1">
                      <p className="text-xs font-semibold">
                        {group.isRelated ? "These files are related" : "These files are unrelated"}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {group.isRelated
                          ? "Imported as ONE subject with multiple chapters (modular)"
                          : "Each file becomes its OWN standalone subject"
                        }
                      </p>
                    </div>
                  </button>

                  {/* Subject metadata — only shown in related/modular mode.
                      In unrelated mode, each file has its OWN title + course
                      code editable directly in the file list below instead. */}
                  {group.isRelated && (
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Subject title">
                        <input
                          className={`${inputClass} text-foreground text-xs`}
                          value={group.subjectTitle}
                          onChange={e => updateGroup(gi, { subjectTitle: e.target.value })}
                          placeholder="e.g. Engineering Maths"
                          disabled={importing}
                        />
                      </Field>
                      <Field label="Course code">
                        <input
                          className={`${inputClass} text-foreground text-xs`}
                          value={group.courseCode}
                          onChange={e => updateGroup(gi, { courseCode: e.target.value })}
                          placeholder="e.g. MTH201"
                          disabled={importing}
                        />
                      </Field>
                    </div>
                  )}
                  {!group.isRelated && (
                    <p className="text-[10px] text-muted-foreground">
                      Each file below has its own Title and Course Code — edit them individually since these files aren't related.
                    </p>
                  )}
                  <Field label="Level">
                    <select
                      className={`${inputClass} text-foreground text-xs`}
                      value={group.level}
                      onChange={e => updateGroup(gi, { level: e.target.value })}
                      disabled={importing}
                    >
                      {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </Field>

                  <button
                    onClick={() => updateGroup(gi, { isPastQuestion: !group.isPastQuestion })}
                    disabled={importing}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                      group.isPastQuestion
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-600"
                        : "bg-surface border-border text-muted-foreground"
                    }`}
                  >
                    {group.isPastQuestion
                      ? <CheckSquare className="h-3.5 w-3.5 shrink-0" />
                      : <Square className="h-3.5 w-3.5 shrink-0" />
                    }
                    <span>
                      {group.isPastQuestion
                        ? "✅ Marked as Past Questions — will appear in Past Questions section"
                        : "Mark as Past Questions (exam papers, previous questions)"
                      }
                    </span>
                    {group.isPastQuestion && (
                      <span className="ml-auto text-[10px] bg-amber-500/20 text-amber-600 px-1.5 py-0.5 rounded-full shrink-0">
                        Auto-detected
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => updateGroup(gi, { isVerified: !group.isVerified })}
                    disabled={importing}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                      group.isVerified
                        ? "bg-green-500/10 border-green-500/30 text-green-600"
                        : "bg-surface border-border text-muted-foreground"
                    }`}
                  >
                    {group.isVerified
                      ? <CheckSquare className="h-3.5 w-3.5 shrink-0" />
                      : <Square className="h-3.5 w-3.5 shrink-0" />
                    }
                    <span>
                      {group.isVerified
                        ? "✅ Marked as Rep Verified"
                        : "Mark as Rep Verified"
                      }
                    </span>
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Current file uploading */}
          {importing && currentFile && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-surface-elevated rounded-lg px-3 py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
              <span className="truncate">Uploading: <span className="text-foreground font-medium">{currentFile}</span></span>
            </div>
          )}

          {/* Import summary */}
          {importSummary && !importing && (
            <div className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium ${importSummary.success > 0 ? "bg-green-500/10 border border-green-500/20 text-green-600" : "bg-destructive/10 border border-destructive/20 text-destructive"}`}>
              <Check className="h-4 w-4 shrink-0" />
              {importSummary.success > 0
                ? `${importSummary.success} PDF${importSummary.success !== 1 ? "s" : ""} imported successfully${importSummary.failed > 0 ? `, ${importSummary.failed} failed` : ""}`
                : `All ${importSummary.failed} files failed — check Drive sharing settings`
              }
            </div>
          )}

          {/* Import button */}
          {groups.length > 0 && !importSummary && (
            <button
              onClick={handleImport}
              disabled={importing || totalSelected === 0}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-brand text-white text-sm font-bold rounded-xl disabled:opacity-50 transition-opacity"
            >
              {importing
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Importing — please wait…</>
                : <>
                    <Check className="h-4 w-4" />
                    Import {totalSelected} PDF{totalSelected !== 1 ? "s" : ""}
                    {activeGroups.length > 1 ? ` across ${activeGroups.length} subjects` : ""}
                  </>
              }
            </button>
          )}

          {/* Start over after successful import */}
          {importSummary && importSummary.success > 0 && (
            <button
              onClick={resetAll}
              className="w-full py-2.5 border border-border text-sm text-muted-foreground rounded-xl hover:bg-surface-elevated"
            >
              Import more files
            </button>
          )}
        </div>
      )}
    </div>
  );
};

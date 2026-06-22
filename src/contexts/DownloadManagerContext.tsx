import { createContext, useContext, useRef, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { savePdfToDevice } from "@/lib/deviceFiles";
import { markModuleUnlocked } from "@/lib/sessionUnlocks";
import { toast } from "sonner";

interface DownloadJob {
  chapterId: string;
  subjectId: string;
  storagePath: string;
  fileName: string;
  courseCode: string;
}

interface DownloadManagerState {
  activeIds: Set<string>;
  startDownload: (job: DownloadJob, userId: string) => Promise<void>;
  isDownloading: (chapterId: string) => boolean;
  onComplete: (cb: () => void) => () => void;
}

const DownloadManagerContext = createContext<DownloadManagerState | null>(null);

export const DownloadManagerProvider = ({ children }: { children: ReactNode }) => {
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());
  const listenersRef = useRef<Set<() => void>>(new Set());

  const onComplete = (cb: () => void) => {
    listenersRef.current.add(cb);
    return () => listenersRef.current.delete(cb);
  };

  const notifyListeners = () => {
    listenersRef.current.forEach((cb) => cb());
  };

  const startDownload = async (job: DownloadJob, userId: string) => {
    setActiveIds((prev) => new Set(prev).add(job.chapterId));

    try {
      const { data } = supabase.storage.from("chapters").getPublicUrl(job.storagePath);
      const uri = await savePdfToDevice(data.publicUrl, job.fileName);
      localStorage.setItem(`hv_dl_${job.chapterId}`, job.fileName);

      const all = (() => {
        try { return JSON.parse(localStorage.getItem("hv_local_pdf_paths") || "{}"); }
        catch { return {}; }
      })();
      all[job.chapterId] = uri;
      localStorage.setItem("hv_local_pdf_paths", JSON.stringify(all));

      const { error: dlErr } = await supabase.from("downloads").insert({
        user_id: userId,
        chapter_id: job.chapterId,
        pdf_id: job.subjectId,
        downloaded_at: new Date().toISOString(),
      });

      if (dlErr) {
        await supabase.from("downloads").insert({
          user_id: userId,
          chapter_id: job.chapterId,
          pdf_id: job.subjectId,
        });
      }

      markModuleUnlocked(job.chapterId);
      toast.success("Download finished — saved to your library");
    } catch (e) {
      console.error("[DownloadManager]", e);
      toast.error(`Couldn't save "${job.courseCode}". Try again.`);
    } finally {
      setActiveIds((prev) => {
        const next = new Set(prev);
        next.delete(job.chapterId);
        return next;
      });
      notifyListeners();
    }
  };

  const isDownloading = (chapterId: string) => activeIds.has(chapterId);

  return (
    <DownloadManagerContext.Provider value={{ activeIds, startDownload, isDownloading, onComplete }}>
      {children}
    </DownloadManagerContext.Provider>
  );
};

export const useDownloadManager = () => {
  const ctx = useContext(DownloadManagerContext);
  if (!ctx) throw new Error("useDownloadManager must be used within DownloadManagerProvider");
  return ctx;
};

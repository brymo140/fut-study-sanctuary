import { Capacitor } from "@capacitor/core";

const isNative = () => Capacitor.isNativePlatform();

// Sanitize filename consistently — must be called the same way on save AND read
export const safeName = (s: string) => s.replace(/[^a-z0-9._-]/gi, "_");

export const savePdfToDevice = async (
  storageUrl: string,
  fileName: string,
  onProgress?: (percent: number) => void
): Promise<string> => {
  if (!isNative()) return storageUrl;

  const { Filesystem, Directory } = await import("@capacitor/filesystem");

  onProgress?.(10);
  const response = await fetch(storageUrl);
  if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);

  onProgress?.(30);
  const blob = await response.blob();

  onProgress?.(50);
  const base64: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  onProgress?.(70);
  const safeFileName = safeName(fileName);
  const result = await Filesystem.writeFile({
    path: `highvault/chapters/${safeFileName}`,
    data: base64,
    directory: Directory.Cache,
    recursive: true,
  });

  onProgress?.(90);

  // Verify the file was actually saved
  try {
    const stat = await Filesystem.stat({
      path: `highvault/chapters/${safeFileName}`,
      directory: Directory.Cache,
    });
    console.log('[deviceFiles] File saved successfully, size:', stat.size);
  } catch (e) {
    throw new Error('File verification failed after save');
  }

  onProgress?.(100);
  return safeFileName; // Return the safe filename so it can be stored in localStorage
};

export const readPdfFromDevice = async (fileName: string): Promise<string | null> => {
  if (!isNative()) return null;
  try {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const safeFileName = safeName(fileName);
    const result = await Filesystem.readFile({
      path: `highvault/chapters/${safeFileName}`,
      directory: Directory.Cache,
    });
    return `data:application/pdf;base64,${result.data}`;
  } catch {
    return null;
  }
};

export const openWithSystemChooser = async (fileName: string): Promise<boolean> => {
  if (!isNative()) return false;
  try {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    const safeFileName = safeName(fileName);
    const stat = await Filesystem.stat({
      path: `highvault/chapters/${safeFileName}`,
      directory: Directory.Cache,
    });
    await Share.share({ url: stat.uri, dialogTitle: "Open with" });
    return true;
  } catch (e) {
    console.error("[deviceFiles] openWithSystemChooser", e);
    return false;
  }
};

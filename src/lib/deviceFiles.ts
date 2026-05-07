// Save downloaded PDFs to the device using Capacitor Filesystem.
// On web (no native runtime), falls back to opening the URL directly.
import { Capacitor } from "@capacitor/core";

const isNative = () => Capacitor.isNativePlatform();

const safeName = (s: string) => s.replace(/[^a-z0-9._-]/gi, "_");

export const savePdfToDevice = async (
  storageUrl: string,
  fileName: string,
  onProgress?: (percent: number) => void
): Promise<string> => {
  if (!isNative()) return storageUrl; // web fallback
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const response = await fetch(storageUrl);
  const blob = await response.blob();
  onProgress?.(50);
  const base64: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  const result = await Filesystem.writeFile({
    path: `highvault/chapters/${safeName(fileName)}`,
    data: base64,
    directory: Directory.Cache,
    recursive: true,
  });
  onProgress?.(100);
  return result.uri;
};

export const readPdfFromDevice = async (fileName: string): Promise<string | null> => {
  if (!isNative()) return null;
  try {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const result = await Filesystem.readFile({
      path: `highvault/chapters/${safeName(fileName)}`,
      directory: Directory.Cache,
    });
    return `data:application/pdf;base64,${result.data}`;
  } catch {
    return null;
  }
};

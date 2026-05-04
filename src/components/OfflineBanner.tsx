// Friendly top banner shown app-wide whenever the device loses connectivity.
import { useOnline } from "@/hooks/useOnline";
import { WifiOff } from "lucide-react";

export const OfflineBanner = () => {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="fixed top-0 inset-x-0 z-[60] bg-warning/15 border-b border-warning/30 backdrop-blur px-4 py-2 flex items-center justify-center gap-2 text-xs font-medium text-warning">
      <WifiOff className="h-3.5 w-3.5" />
      You are offline 📡 — some features may be unavailable
    </div>
  );
};

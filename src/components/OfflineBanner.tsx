// Bottom offline banner — sits in the same slot as the AdMob banner.
// Used app-wide so layout never shifts when connectivity flips.
import { useOnline } from "@/hooks/useOnline";
import { WifiOff } from "lucide-react";

export const OfflineBanner = () => {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      style={{ bottom: 0, height: "50px" }}
      className="fixed inset-x-0 z-50 bg-warning/15 border-t border-warning/30 backdrop-blur px-4 flex items-center justify-center gap-2 text-xs font-medium text-warning"
    >
      <WifiOff className="h-3.5 w-3.5" />
      📡 You're offline — some features unavailable
    </div>
  );
};

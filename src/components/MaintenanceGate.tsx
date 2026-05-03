// Full-screen blocker shown to non-admin students when maintenance_mode = true.
// Admins always bypass so they can keep working.
import { ReactNode } from "react";
import { useSettings } from "@/contexts/SettingsContext";
import { useAuth } from "@/contexts/AuthContext";

export const MaintenanceGate = ({ children }: { children: ReactNode }) => {
  const { maintenance_mode } = useSettings();
  const { isAdmin } = useAuth();

  if (maintenance_mode && !isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-background">
        <div className="text-6xl mb-4">🔧</div>
        <h1 className="text-2xl font-bold mb-2">
          <span style={{ color: "#3b8bf5" }}>HIGH</span>
          <span style={{ color: "#9b5cf6" }}>VAULT</span>
        </h1>
        <p className="text-base text-foreground/80 max-w-sm leading-relaxed">
          HighVault is currently undergoing maintenance. Please check back soon. 🔧
        </p>
      </div>
    );
  }
  return <>{children}</>;
};

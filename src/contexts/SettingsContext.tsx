// Live app-wide settings (tagline, maintenance mode, AdMob app id) sourced
// from the app_settings key/value table. Updates in real-time via Supabase
// realtime so admin changes reflect across all open sessions immediately.
import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AppSettings {
  app_tagline: string;
  admob_app_id: string;
  maintenance_mode: boolean;
}

const DEFAULTS: AppSettings = {
  app_tagline: "FUTMinna · Your Academic Sanctuary",
  admob_app_id: "ca-pub-4988426041877845",
  maintenance_mode: false,
};

interface Ctx extends AppSettings {
  loading: boolean;
  refresh: () => Promise<void>;
}

const SettingsContext = createContext<Ctx | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase.from("app_settings").select("*");
    const rows = (data || []) as any[];
    const legacy = rows.find((r) => r.id === 1) || {};
    const byKey: Record<string, string> = {};
    for (const r of rows) if (r.key) byKey[r.key] = r.value;

    setSettings({
      app_tagline: byKey.app_tagline ?? legacy.app_tagline ?? DEFAULTS.app_tagline,
      admob_app_id:
        byKey.admob_app_id ??
        byKey.adsense_publisher_id ??
        legacy.adsense_publisher_id ??
        DEFAULTS.admob_app_id,
      maintenance_mode:
        String(byKey.maintenance_mode ?? legacy.maintenance_mode ?? "false") === "true",
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel("settings-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refresh]);

  return (
    <SettingsContext.Provider value={{ ...settings, loading, refresh }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
};

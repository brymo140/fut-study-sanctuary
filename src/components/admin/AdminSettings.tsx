import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { SectionHeader, Field, inputClass } from "./ui";
import { getDatabaseErrorMessage, withSchemaRetry } from "@/lib/supabaseRetry";

interface Settings {
  adsense_publisher_id: string;
  app_tagline: string;
  maintenance_mode: boolean;
}

export const AdminSettings = () => {
  const { profile, refreshProfile } = useAuth();
  const [settings, setSettings] = useState<Settings>({ adsense_publisher_id: "", app_tagline: "", maintenance_mode: false });
  const [displayName, setDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("app_settings").select("*").then(({ data }) => {
      const rows = (data || []) as any[];
      const legacy = rows.find((row) => row.id === 1) || {};
      const byKey = Object.fromEntries(rows.filter((row) => row.key).map((row) => [row.key, row.value]));
      setSettings({
        adsense_publisher_id: byKey.adsense_publisher_id ?? legacy.adsense_publisher_id ?? "",
        app_tagline: byKey.app_tagline ?? legacy.app_tagline ?? "",
        maintenance_mode: String(byKey.maintenance_mode ?? legacy.maintenance_mode ?? "false") === "true",
      });
    });
    setDisplayName(profile?.full_name || "");
  }, [profile?.full_name]);

  const saveSettings = async () => {
    setBusy(true);
    const now = new Date().toISOString();
    const { error } = await withSchemaRetry(async () => {
      const legacy = await supabase.from("app_settings").update({
        adsense_publisher_id: settings.adsense_publisher_id,
        app_tagline: settings.app_tagline,
        maintenance_mode: settings.maintenance_mode,
        updated_at: now,
      }).eq("id", 1);
      if (legacy.error) return legacy;
      return (supabase.from("app_settings") as any).upsert([
        { key: "adsense_publisher_id", value: settings.adsense_publisher_id, updated_at: now },
        { key: "app_tagline", value: settings.app_tagline, updated_at: now },
        { key: "maintenance_mode", value: String(settings.maintenance_mode), updated_at: now },
      ], { onConflict: "key" });
    });
    setBusy(false);
    if (error) toast.error(getDatabaseErrorMessage(error)); else toast.success("Settings saved");
  };

  const saveProfile = async () => {
    if (!profile) return;
    const { error } = await withSchemaRetry(() => supabase.from("profiles").update({ full_name: displayName }).eq("id", profile.id));
    if (error) { toast.error(getDatabaseErrorMessage(error)); return; }
    await refreshProfile();
    toast.success("Display name updated");
  };

  const changePassword = async () => {
    if (newPassword.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { toast.error(error.message); return; }
    setNewPassword("");
    toast.success("Password changed");
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Settings" subtitle="Admin profile and app-wide configuration" />

      {/* Admin profile */}
      <div className="surface-card p-4 space-y-3">
        <p className="text-sm font-bold">Admin profile</p>
        <Field label="Display name">
          <input className={inputClass} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </Field>
        <button onClick={saveProfile} className="w-full bg-gradient-button border border-primary/40 text-primary text-sm font-semibold rounded-lg py-2">Save name</button>

        <Field label="New password" hint="Min 8 characters">
          <input type="password" className={inputClass} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" />
        </Field>
        <button onClick={changePassword} className="w-full bg-gradient-button border border-primary/40 text-primary text-sm font-semibold rounded-lg py-2">Change password</button>
      </div>

      {/* App-wide */}
      <div className="surface-card p-4 space-y-3">
        <p className="text-sm font-bold">App configuration</p>
        <Field label="Google AdSense Publisher ID" hint="e.g. ca-pub-1234567890123456">
          <input className={inputClass} value={settings.adsense_publisher_id} onChange={(e) => setSettings({ ...settings, adsense_publisher_id: e.target.value })} />
        </Field>
        <Field label="Welcome tagline" hint="Shown on the welcome screen">
          <input className={inputClass} value={settings.app_tagline} onChange={(e) => setSettings({ ...settings, app_tagline: e.target.value })} />
        </Field>
        <label className="flex items-center justify-between bg-surface border border-border rounded-lg px-3 py-2.5">
          <div>
            <p className="text-sm font-semibold">Maintenance mode</p>
            <p className="text-[11px] text-muted-foreground">Show students a maintenance message</p>
          </div>
          <input type="checkbox" className="h-5 w-5 accent-primary"
            checked={settings.maintenance_mode}
            onChange={(e) => setSettings({ ...settings, maintenance_mode: e.target.checked })} />
        </label>
        <button disabled={busy} onClick={saveSettings} className="w-full bg-gradient-button border border-primary/40 text-primary text-sm font-semibold rounded-lg py-2.5 disabled:opacity-50">
          {busy ? "Saving…" : "Save settings"}
        </button>
      </div>
    </div>
  );
};

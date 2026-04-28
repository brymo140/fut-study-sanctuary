import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { SectionHeader, Field, inputClass } from "./ui";

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
    supabase.from("app_settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) setSettings({
        adsense_publisher_id: data.adsense_publisher_id || "",
        app_tagline: data.app_tagline || "",
        maintenance_mode: data.maintenance_mode,
      });
    });
    setDisplayName(profile?.full_name || "");
  }, [profile?.full_name]);

  const saveSettings = async () => {
    setBusy(true);
    const { error } = await supabase.from("app_settings").update({
      adsense_publisher_id: settings.adsense_publisher_id,
      app_tagline: settings.app_tagline,
      maintenance_mode: settings.maintenance_mode,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    setBusy(false);
    if (error) toast.error(error.message); else toast.success("Settings saved");
  };

  const saveProfile = async () => {
    if (!profile) return;
    const { error } = await supabase.from("profiles").update({ full_name: displayName }).eq("id", profile.id);
    if (error) { toast.error(error.message); return; }
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

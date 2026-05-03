import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { toast } from "sonner";
import { SectionHeader, Field, inputClass } from "./ui";
import { getDatabaseErrorMessage, withSchemaRetry } from "@/lib/supabaseRetry";

interface SettingsForm {
  admob_app_id: string;
  app_tagline: string;
  maintenance_mode: boolean;
}

export const AdminSettings = () => {
  const { profile, refreshProfile } = useAuth();
  const live = useSettings();
  const [form, setForm] = useState<SettingsForm>({
    admob_app_id: "",
    app_tagline: "",
    maintenance_mode: false,
  });
  const [displayName, setDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // Hydrate from live settings (which read app_settings + listen for changes).
  useEffect(() => {
    setForm({
      admob_app_id: live.admob_app_id,
      app_tagline: live.app_tagline,
      maintenance_mode: live.maintenance_mode,
    });
  }, [live.admob_app_id, live.app_tagline, live.maintenance_mode]);

  useEffect(() => { setDisplayName(profile?.full_name || ""); }, [profile?.full_name]);

  const saveSettings = async () => {
    setBusy(true);
    const now = new Date().toISOString();
    const { error } = await withSchemaRetry(async () =>
      await (supabase.from("app_settings") as any).upsert(
        [
          { key: "admob_app_id", value: form.admob_app_id, updated_at: now },
          { key: "app_tagline", value: form.app_tagline, updated_at: now },
          { key: "maintenance_mode", value: String(form.maintenance_mode), updated_at: now },
        ],
        { onConflict: "key" }
      )
    );
    setBusy(false);
    if (error) { toast.error(getDatabaseErrorMessage(error)); return; }
    await live.refresh();
    toast.success("Settings saved — live across the app");
  };

  const saveProfile = async () => {
    if (!profile) return;
    const { error } = await withSchemaRetry(async () =>
      await supabase.from("profiles").update({ full_name: displayName }).eq("id", profile.id)
    );
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

      <div className="surface-card p-4 space-y-3">
        <p className="text-sm font-bold">App configuration</p>
        <Field label="AdMob App ID" hint="e.g. ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX">
          <input className={inputClass} value={form.admob_app_id}
            onChange={(e) => setForm({ ...form, admob_app_id: e.target.value })}
            placeholder="ca-app-pub-XXXX" />
        </Field>
        <Field label="Welcome tagline" hint="Reflects on the welcome screen instantly">
          <input className={inputClass} value={form.app_tagline}
            onChange={(e) => setForm({ ...form, app_tagline: e.target.value })} />
        </Field>
        <label className="flex items-center justify-between bg-surface border border-border rounded-lg px-3 py-2.5">
          <div>
            <p className="text-sm font-semibold">Maintenance mode</p>
            <p className="text-[11px] text-muted-foreground">Show students a maintenance screen until turned off</p>
          </div>
          <input type="checkbox" className="h-5 w-5 accent-primary"
            checked={form.maintenance_mode}
            onChange={(e) => setForm({ ...form, maintenance_mode: e.target.checked })} />
        </label>
        <button disabled={busy} onClick={saveSettings} className="w-full bg-gradient-button border border-primary/40 text-primary text-sm font-semibold rounded-lg py-2.5 disabled:opacity-50">
          {busy ? "Saving…" : "Save settings"}
        </button>
      </div>
    </div>
  );
};

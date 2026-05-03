import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Sends pushes to native devices (when push_tokens exist) and is a no-op
// for the web build. Always returns 200 with a sent count so callers don't fail.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { title, body, target_level, target_department, url } = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: tokens } = await supabase
      .from("push_tokens")
      .select("token, platform, user_id, profiles(level, department)");

    const matching = (tokens || []).filter((t: any) => {
      if (!target_level || target_level === "all") return true;
      if (t.profiles?.level !== target_level) return false;
      if (target_department && t.profiles?.department !== target_department) return false;
      return true;
    });

    const fcmKey = Deno.env.get("FCM_SERVER_KEY");
    let sent = 0;
    if (fcmKey) {
      for (const t of matching) {
        try {
          await fetch("https://fcm.googleapis.com/fcm/send", {
            method: "POST",
            headers: { Authorization: `key=${fcmKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              to: (t as any).token,
              notification: { title: title || "HighVault 📚", body },
              data: { url: url || "/" },
            }),
          });
          sent++;
        } catch (e) {
          console.warn("FCM send failed", e);
        }
      }
    }

    return new Response(JSON.stringify({ sent, matched: matching.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-push error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

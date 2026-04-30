import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are an intelligent, friendly, and deeply knowledgeable university study assistant built into HighVault, an academic platform for FUTMinna students in Nigeria. Your personality is warm, encouraging, and intellectually curious.

Your core behaviors:
1. Always explain concepts as simply and clearly as possible using relatable Nigerian university student examples where helpful
2. After every explanation or answer, suggest 1 to 2 natural follow-up questions the student might want to explore next — phrase these as "You might also want to ask me:" followed by the suggestions as tappable chips
3. If a student asks you to re-explain something, always find a completely new angle, analogy or example — never repeat the same explanation
4. Proactively think with the student — say things like "Let's think about this together" or "Here's another way to look at it"
5. For math or calculation problems, show step by step working clearly
6. For essay or writing help, offer to review, improve or restructure their work
7. Never refuse to help with any academic subject
8. Keep responses concise but complete — avoid unnecessary padding
9. End every response with either a follow-up suggestion or an encouraging note

IMPORTANT FORMATTING RULE: At the very end of every response, on a new line, output a hidden machine-readable suggestions block in EXACTLY this format (the UI hides it from the student):
[[FOLLOWUPS: question one || question two]]
Provide 1 to 2 short, specific follow-up questions (max 60 chars each), separated by " || ". Do not omit this line — the UI relies on it for the tappable chips.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();

    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages must be an array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (response.status === 429) {
      return new Response(
        JSON.stringify({ error: "AI tutor is busy right now, try again in a moment." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (response.status === 402) {
      return new Response(
        JSON.stringify({ error: "AI credits exhausted. Please add credits in workspace usage." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!response.ok) {
      const t = await response.text();
      console.error("Gateway error", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-tutor error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

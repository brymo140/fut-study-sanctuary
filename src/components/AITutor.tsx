import { useEffect, useRef, useState } from "react";
import { Bot, Send, X, Sparkles, RefreshCw, Trash2, ImagePlus } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type Msg = {
  role: "user" | "assistant";
  content: string | ContentPart[];
  // For UI rendering of user messages with image
  image?: string;
  text?: string;
};

const STREAM_URL = "https://dcikanpfsgzxufjlkngd.supabase.co/functions/v1/ai-tutor";
const FOLLOWUPS_RE = /\[\[FOLLOWUPS:\s*([^\]]+?)\]\]\s*$/i;

const splitFollowups = (raw: string): { text: string; chips: string[] } => {
  const m = raw.match(FOLLOWUPS_RE);
  if (!m) return { text: raw, chips: [] };
  const text = raw.replace(FOLLOWUPS_RE, "").trimEnd();
  const chips = m[1].split("||").map((s) => s.trim()).filter(Boolean).slice(0, 2);
  return { text, chips };
};

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export const AITutor = ({
  externalOpen,
  onExternalClose,
}: {
  externalOpen?: boolean;
  onExternalClose?: () => void;
} = {}) => {
  const [open, setOpen] = useState(false);

  // When PdfViewer triggers externalOpen, open the panel
  useEffect(() => {
    if (externalOpen) setOpen(true);
  }, [externalOpen]);

  const handleClose = () => {
    setOpen(false);
    onExternalClose?.();
  };
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const handlePickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Image too large — max 4MB");
      return;
    }
    if (!/^image\//.test(file.type)) {
      toast.error("Only image files supported");
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setPendingImage(dataUrl);
    } catch {
      toast.error("Couldn't read that image");
    }
  };

  const send = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (loading) return;
    if (!text && !pendingImage) return;

    const userText = text || (pendingImage ? "Please explain what is in this image as simply as possible" : "");

    // Build the API content (multimodal if image present).
    const apiContent: string | ContentPart[] = pendingImage
      ? [
          { type: "image_url", image_url: { url: pendingImage } },
          { type: "text", text: userText },
        ]
      : userText;

    const userMsg: Msg = {
      role: "user",
      content: apiContent,
      image: pendingImage || undefined,
      text: userText,
    };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setPendingImage(null);
    setLoading(true);

    // Strip UI-only fields before sending.
    const apiMessages = next.map((m) => ({ role: m.role, content: m.content }));

    let assistantSoFar = "";
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantSoFar, text: assistantSoFar } : m
          );
        }
        return [...prev, { role: "assistant", content: assistantSoFar, text: assistantSoFar }];
      });
    };

    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 10_000);
      const resp = await fetch(STREAM_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: apiMessages }),
        signal: controller.signal,
      });
      window.clearTimeout(timeout);

      if (resp.status === 429) {
        const textBody = await resp.text();
        console.error("AI tutor 429:", textBody);
        upsert(textBody || "⚠️ The AI tutor is busy. Try again in a moment.");
        return;
      }
      if (resp.status === 402) {
        const textBody = await resp.text();
        console.error("AI tutor 402:", textBody);
        upsert(textBody || "⚠️ AI credits are exhausted.");
        return;
      }
      if (!resp.ok || !resp.body) {
        const textBody = await resp.text();
        console.error("AI tutor non-ok response:", resp.status, textBody);
        upsert(textBody || "Sorry — couldn't reach the tutor right now.");
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;
      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsert(content);
          } catch (parseErr) {
            console.error("AI tutor stream parse error:", parseErr, line);
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error("AI tutor request failed:", e);
      if (e instanceof Error && e.name === "AbortError") {
        upsert("Request timed out after 10 seconds. Please try again.");
      } else {
        upsert(e instanceof Error ? e.message : "Sorry — something went wrong.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        data-onboarding="ai-tutor"
        aria-label="Open AI study assistant"
        style={{ bottom: "calc(var(--bottom-chrome) + 12px)" }}
        className={`fixed right-4 z-40 h-14 w-14 rounded-full bg-gradient-brand shadow-glow flex items-center justify-center transition-transform hover:scale-110 animate-pulse-glow ${externalOpen !== undefined ? 'hidden' : ''}`}
      >
        <Bot className="h-6 w-6 text-white" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => handleClose()}>
          <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
          <div
            className="relative w-full app-shell h-[75vh] mb-16 surface-elevated rounded-t-3xl rounded-b-none border-t border-x flex flex-col animate-slide-up"
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-brand flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">AI study assistant</h2>
                  <p className="text-xs text-muted-foreground">Powered by Groq · text or photo</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button onClick={() => setMessages([])} aria-label="Clear chat" title="Clear chat"
                    className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <button onClick={() => handleClose()} aria-label="Close"
                  className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <div className="inline-flex h-16 w-16 rounded-2xl bg-gradient-brand items-center justify-center mb-4">
                    <Bot className="h-8 w-8 text-white" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Hi! Ask me anything, or attach a photo of a textbook page or your handwritten notes.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 justify-center">
                    {["Explain Newton's second law", "What is integration by parts?", "Help me understand normalization"].map((s) => (
                      <button key={s} onClick={() => setInput(s)}
                        className="text-xs px-3 py-1.5 rounded-full bg-primary/10 border border-primary/40 text-primary hover:bg-primary/20 transition-colors">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) => {
                const isLastAssistant = m.role === "assistant" && i === messages.length - 1 && !loading;
                const raw = typeof m.content === "string" ? m.content : (m.text || "");
                const { text, chips } = m.role === "assistant" ? splitFollowups(raw) : { text: m.text || raw, chips: [] };
                return (
                  <div key={i} className="space-y-2">
                    <div className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        m.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "surface-card rounded-bl-sm"
                      }`}>
                        {m.role === "user" && m.image && (
                          <img src={m.image} alt="attachment" className="mb-2 max-h-40 rounded-lg" />
                        )}
                        {m.role === "assistant" ? (
                          <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_ul]:my-2 [&_ol]:my-2 [&_strong]:text-primary">
                            <ReactMarkdown>{text || "…"}</ReactMarkdown>
                          </div>
                        ) : (
                          text && <p className="whitespace-pre-wrap">{text}</p>
                        )}
                      </div>
                    </div>
                    {isLastAssistant && (chips.length > 0 || text) && (
                      <div className="flex flex-wrap gap-2 pl-1">
                        {chips.map((c) => (
                          <button key={c} onClick={() => send(c)}
                            className="text-[11px] px-3 py-1.5 rounded-full bg-primary/10 border border-primary/40 text-primary hover:bg-primary/20 transition-colors">
                            {c}
                          </button>
                        ))}
                        <button onClick={() => send("Please explain that in a completely different way with a new example")}
                          className="text-[11px] px-3 py-1.5 rounded-full surface-card hover:border-primary text-foreground/80 inline-flex items-center gap-1">
                          <RefreshCw className="h-3 w-3" /> Explain differently
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {loading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex justify-start">
                  <div className="surface-card rounded-2xl rounded-bl-sm px-4 py-3">
                    <div className="flex gap-1">
                      <span className="typing-dot h-2 w-2 rounded-full bg-primary" />
                      <span className="typing-dot h-2 w-2 rounded-full bg-primary" />
                      <span className="typing-dot h-2 w-2 rounded-full bg-primary" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Pending image preview */}
            {pendingImage && (
              <div className="px-3 pt-2">
                <div className="relative inline-block">
                  <img src={pendingImage} alt="attached" className="h-20 rounded-lg border border-border" />
                  <button onClick={() => setPendingImage(null)}
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-white flex items-center justify-center">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}

            <div className="p-3 border-t border-border flex gap-2 items-center" onClick={(e) => e.stopPropagation()}>
              <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={handlePickImage} />
              <button
                onClick={() => fileInput.current?.click()}
                className="h-10 w-10 shrink-0 rounded-full surface-card flex items-center justify-center hover:border-primary"
                aria-label="Attach image"
                disabled={loading}
              >
                <ImagePlus className="h-4 w-4 text-primary" />
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder={pendingImage ? "Add a question (optional)…" : "Ask anything…"}
                className="flex-1 bg-surface border border-border rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
                disabled={loading}
              />
              <Button
                size="icon"
                onClick={() => send()}
                disabled={loading || (!input.trim() && !pendingImage)}
                className="rounded-full bg-gradient-brand hover:opacity-90 h-10 w-10 shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

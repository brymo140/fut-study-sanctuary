import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MessageSquarePlus, Send, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const COMMON_SUBJECTS = [
  "Past Questions",
  "Lecture Notes",
  "Textbooks",
  "Assignment Solutions",
  "Lab Manuals",
  "Other",
];

const Feedback = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [subjectName, setSubjectName] = useState("");
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!user) return;
    if (!subjectName.trim()) {
      toast.error("Please enter the subject or material name.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("feedback").insert({
        user_id: user.id,
        full_name: profile?.full_name || null,
        level: profile?.level || null,
        subject_name: subjectName.trim(),
        note: note.trim() || null,
        status: "pending",
      });

      if (error) {
        toast.error("Could not submit. Please try again.");
        console.error("[Feedback]", error);
        return;
      }

      setSubmitted(true);
    } catch (e) {
      toast.error("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center space-y-5">
        <div className="h-20 w-20 rounded-full bg-success/10 flex items-center justify-center">
          <CheckCircle2 className="h-10 w-10 text-success" />
        </div>
        <div>
          <h2 className="text-xl font-bold mb-2">Request Sent! 🎉</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Thanks for letting us know! We'll do our best to upload
            <span className="font-semibold text-foreground"> {subjectName} </span>
            as soon as possible.
          </p>
        </div>
        <Button onClick={() => navigate("/")} className="w-full max-w-xs h-11 rounded-xl">
          Back to Home
        </Button>
        <button
          onClick={() => { setSubmitted(false); setSubjectName(""); setNote(""); }}
          className="text-xs text-muted-foreground"
        >
          Submit another request
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="h-9 w-9 rounded-full surface-card flex items-center justify-center"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-lg font-bold">Request Material</h1>
          <p className="text-xs text-muted-foreground">Tell us what you're looking for</p>
        </div>
      </div>

      {/* Info card */}
      <div className="surface-card p-4 flex items-start gap-3">
        <MessageSquarePlus className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold">Can't find your material?</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Let us know what course material, past question, or textbook you need.
            Our team will review and upload it as soon as possible.
          </p>
        </div>
      </div>

      {/* Quick select */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Quick select
        </p>
        <div className="flex flex-wrap gap-2">
          {COMMON_SUBJECTS.map((s) => (
            <button
              key={s}
              onClick={() => setSubjectName(s === subjectName ? "" : s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                subjectName === s
                  ? "bg-primary/15 border-primary/50 text-primary"
                  : "bg-surface border-border text-muted-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Form */}
      <div className="surface-card p-4 space-y-4">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
            Course / Material Name *
          </label>
          <input
            value={subjectName}
            onChange={(e) => setSubjectName(e.target.value)}
            placeholder="e.g. MTH 201 Past Questions, Engineering Drawing notes..."
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
            Additional Details (optional)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 300))}
            placeholder="Any specific year, semester, or other details that would help us find it..."
            rows={4}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:border-primary resize-none"
          />
          <p className="text-[10px] text-muted-foreground mt-1 text-right">
            {note.length}/300
          </p>
        </div>

        {/* Auto-filled user info */}
        {profile?.level && (
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 rounded-lg">
            <span className="text-[10px] text-muted-foreground">
              Submitting as: <span className="text-foreground font-medium">
                {profile.full_name || "Student"} · {profile.level}
              </span>
            </span>
          </div>
        )}
      </div>

      <Button
        onClick={handleSubmit}
        disabled={loading || !subjectName.trim()}
        className="w-full h-12 rounded-xl font-semibold text-sm"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Sending...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Send Request
          </span>
        )}
      </Button>
    </div>
  );
};

export default Feedback;

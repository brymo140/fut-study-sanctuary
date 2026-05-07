import { useEffect, useMemo, useState } from "react";

const KEY = "hv_onboarding_done";

const steps = [
  { selector: '[data-onboarding="browse"]', text: "Find course materials here 📚" },
  { selector: '[data-onboarding="watch"]', text: "Video tutorials by level 🎥" },
  { selector: '[data-onboarding="ai-tutor"]', text: "Ask AI anything, anytime 🤖" },
  { selector: '[data-onboarding="downloads"]', text: "Your personal library 📖" },
  { selector: "", text: "You're all set! Welcome to HighVault 🎉" },
];

export const OnboardingGuide = () => {
  const [step, setStep] = useState(0);
  const [show, setShow] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const current = useMemo(() => steps[step], [step]);

  useEffect(() => {
    if (localStorage.getItem(KEY) === "1") return;
    setShow(true);
  }, []);

  useEffect(() => {
    if (!show || !current?.selector) {
      setRect(null);
      return;
    }
    const el = document.querySelector(current.selector);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [show, current]);

  if (!show) return null;

  const finish = () => {
    localStorage.setItem(KEY, "1");
    setShow(false);
  };

  return (
    <div className="fixed inset-0 z-[70]">
      <div
        className="absolute inset-0 backdrop-blur-sm"
        style={{
          background: rect
            ? `radial-gradient(circle at ${rect.left + rect.width / 2}px ${rect.top + rect.height / 2}px, rgba(0,0,0,0) 0%, rgba(0,0,0,0.45) 38%, rgba(0,0,0,0.72) 78%)`
            : "rgba(0,0,0,0.55)",
        }}
      />
      {rect && (
        <div
          className="absolute rounded-xl border-2 border-primary/70 pointer-events-none"
          style={{
            left: rect.left - 10,
            top: rect.top - 10,
            width: rect.width + 20,
            height: rect.height + 20,
            boxShadow: "0 0 0 6px rgba(59,139,245,0.12), 0 0 30px rgba(59,139,245,0.25)",
          }}
        />
      )}
      <button onClick={finish} className="absolute top-5 right-5 text-xs text-white/90">Skip</button>
      <div className="absolute left-1/2 -translate-x-1/2 bottom-24 w-[90%] max-w-sm surface-card p-4 text-center">
        <p className="text-sm font-semibold">{current.text}</p>
        <button
          onClick={() => {
            if (step === steps.length - 1) finish();
            else setStep((s) => s + 1);
          }}
          className="mt-3 w-full bg-gradient-button border border-primary/40 rounded-lg py-2 text-sm"
        >
          {step === steps.length - 1 ? "Let's go!" : "Next"}
        </button>
      </div>
    </div>
  );
};

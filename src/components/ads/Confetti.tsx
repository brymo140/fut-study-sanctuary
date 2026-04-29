import { useEffect, useState } from "react";

/** Lightweight CSS confetti. Auto-stops after `durationMs`. */
export const Confetti = ({ durationMs = 2000 }: { durationMs?: number }) => {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setOn(false), durationMs);
    return () => clearTimeout(t);
  }, [durationMs]);
  if (!on) return null;
  const pieces = Array.from({ length: 40 });
  const colors = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--warning))", "hsl(var(--success))"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.4;
        const dur = 1.4 + Math.random() * 0.8;
        const color = colors[i % colors.length];
        const size = 6 + Math.random() * 4;
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              top: "-10px",
              left: `${left}%`,
              width: size,
              height: size,
              backgroundColor: color,
              borderRadius: 2,
              animation: `confetti-fall ${dur}s ${delay}s ease-in forwards`,
              transform: `rotate(${Math.random() * 360}deg)`,
            }}
          />
        );
      })}
      <style>{`
        @keyframes confetti-fall {
          to { transform: translateY(420px) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

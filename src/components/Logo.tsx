import { Link } from "react-router-dom";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const Logo = ({ size = "md", className = "" }: LogoProps) => {
  const sizes = {
    sm: "text-xl",
    md: "text-2xl",
    lg: "text-5xl",
  };
  return (
    <Link
      to="/"
      className={`font-bold tracking-tight ${sizes[size]} ${className}`}
      style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }}
      aria-label="StudyHub FUTMinna home"
    >
      <span className="text-primary">STUDY</span>
      <span className="text-secondary">HUB</span>
    </Link>
  );
};

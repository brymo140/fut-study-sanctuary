import { Link } from "react-router-dom";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

// HighVault brand mark: "HIGH" in electric blue, "VAULT" in purple.
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
      aria-label="HighVault home"
    >
      <span style={{ color: "#3b8bf5" }}>HIGH</span>
      <span style={{ color: "#9b5cf6" }}>VAULT</span>
    </Link>
  );
};

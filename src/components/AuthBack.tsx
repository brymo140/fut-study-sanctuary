import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const AuthBack = ({ to }: { to?: string }) => {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => (to ? navigate(to) : navigate(-1))}
      aria-label="Back"
      className="h-10 w-10 rounded-full surface-card flex items-center justify-center hover:border-primary mb-4"
    >
      <ArrowLeft className="h-4 w-4" />
    </button>
  );
};

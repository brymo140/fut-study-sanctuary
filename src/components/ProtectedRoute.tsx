import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { SplashLoader } from "@/components/SplashLoader";

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { session, loading } = useAuth();
  const location = useLocation();

  // Check if there's any Supabase session in localStorage
  const hasLocalSession = Object.keys(localStorage).some(k => 
    k.includes('sb-') && k.includes('-auth-token')
  );

  // While loading — but if offline and we have a stored session, skip loading
  if (loading && !hasLocalSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <SplashLoader label="Loading..." />
      </div>
    );
  }

  // No session and no stored session — go to welcome
  if (!loading && !session && !hasLocalSession) {
    return <Navigate to="/welcome" state={{ from: location.pathname }} replace />;
  }

  // Has session or stored session — show content
  return <>{children}</>;
};

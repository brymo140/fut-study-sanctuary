import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { SplashLoader } from "@/components/SplashLoader";

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { session, loading } = useAuth();
  const location = useLocation();

  // Always show loader while auth is initializing
  // Never redirect during loading — wait for definitive answer
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <SplashLoader label="Loading session..." />
      </div>
    );
  }

  // Only redirect if loading is complete AND no session exists
  if (!loading && !session) {
    return <Navigate to="/welcome" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
};

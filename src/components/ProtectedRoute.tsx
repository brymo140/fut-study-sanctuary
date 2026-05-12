import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { SplashLoader } from "@/components/SplashLoader";

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { session, loading } = useAuth();
  const location = useLocation();
  const [offlineTimeout, setOfflineTimeout] = useState(false);

  useEffect(() => {
    // If offline and loading takes too long, show cached content
    if (!navigator.onLine) {
      const timer = setTimeout(() => setOfflineTimeout(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  // If offline and we have a stored session indicator, show app
  if (!navigator.onLine && offlineTimeout) {
    const hasStoredSession = localStorage.getItem('supabase.auth.token') ||
      Object.keys(localStorage).some(k => k.includes('supabase'));
    if (hasStoredSession) {
      return <>{children}</>;
    }
    return <Navigate to="/welcome" replace />;
  }

  if (loading && !offlineTimeout) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <SplashLoader label="Loading..." />
      </div>
    );
  }

  if (!loading && !session) {
    return <Navigate to="/welcome" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
};

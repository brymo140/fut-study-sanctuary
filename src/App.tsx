import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { MaintenanceGate } from "@/components/MaintenanceGate";
import { OfflineBanner } from "@/components/OfflineBanner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SplashLoader } from "@/components/SplashLoader";
import { showAppOpenAd } from "@/lib/admob";

import Welcome from "./pages/Welcome";
import Signup from "./pages/Signup";
import SignupProfile from "./pages/SignupProfile";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Home from "./pages/Home";
import Browse from "./pages/Browse";
import PdfDetail from "./pages/PdfDetail";
import Watch from "./pages/Watch";
import Downloads from "./pages/Downloads";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import AuthCallback from "./pages/AuthCallback";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();
const THEME_KEY = "hv_theme";

const Protected = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <MaintenanceGate>
      <AppLayout>{children}</AppLayout>
    </MaintenanceGate>
  </ProtectedRoute>
);

const App = () => {
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    // Show app open ad when app starts
if (navigator.onLine) {
  setTimeout(() => showAppOpenAd(), 2000);
}
    // Clear corrupted localStorage PDF cache entries
// Remove entries that contain base64 data instead of filenames
Object.keys(localStorage).forEach(key => {
  if (key.startsWith('hv_dl_')) {
    const value = localStorage.getItem(key);
    if (value && value.startsWith('data:')) {
      console.log('Clearing corrupted cache entry:', key);
      localStorage.removeItem(key);
    }
  }
});
    const savedTheme = localStorage.getItem(THEME_KEY);
    document.documentElement.classList.toggle("light", savedTheme === "light");
    const t = window.setTimeout(() => setBooting(false), 400);
    return () => window.clearTimeout(t);
  }, []);

  if (booting) {
    return <SplashLoader label="Starting HighVault..." />;
  }

  return (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner theme="dark" position="top-center" offset="60px" />
        <OfflineBanner />
        <BrowserRouter>
        <AuthProvider>
          <SettingsProvider>
            <Routes>
              <Route path="/welcome" element={<Welcome />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/signup/profile" element={<SignupProfile />} />
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/auth/callback" element={<AuthCallback />} />


              <Route path="/" element={<Protected><Home /></Protected>} />
              <Route path="/browse" element={<Protected><Browse /></Protected>} />
              <Route path="/pdf/:id" element={<Protected><PdfDetail /></Protected>} />
              <Route path="/watch" element={<Protected><Watch /></Protected>} />
              <Route path="/downloads" element={<Protected><Downloads /></Protected>} />
              <Route path="/profile" element={<Protected><Profile /></Protected>} />
              <Route path="/admin" element={<Protected><Admin /></Protected>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </SettingsProvider>
        </AuthProvider>
      </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
  );
};

export default App;

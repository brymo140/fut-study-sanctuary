import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Navigate, useNavigate } from "react-router-dom";

const Admin = () => {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Admin panel</h1>
      <p className="text-sm text-muted-foreground">
        You're signed in as an admin. The full admin tools (upload PDFs, manage users, post announcements,
        manage YouTube hub) will land in the next iteration.
      </p>
      <div className="surface-card p-6 text-center">
        <p className="text-4xl mb-3">🛠️</p>
        <p className="text-sm font-semibold">Admin tools coming next</p>
        <p className="text-xs text-muted-foreground mt-1">
          PDF uploads · User management · Announcements · YouTube channel management
        </p>
      </div>
      <Button onClick={() => navigate("/")} variant="outline" className="w-full bg-surface border-border">
        Back to app
      </Button>
    </div>
  );
};

export default Admin;

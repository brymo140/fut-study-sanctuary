import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { AITutor } from "./AITutor";

export const AppLayout = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith("/admin");
  return (
    <div className="min-h-screen pb-20">
      <div className={`${isAdmin ? "max-w-5xl mx-auto" : "app-shell"} px-4 pt-4`}>{children}</div>
      {!isAdmin && <AITutor />}
      <BottomNav />
    </div>
  );
};

import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { AITutor } from "./AITutor";

export const AppLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="min-h-screen pb-20">
      <div className="app-shell px-4 pt-4">{children}</div>
      <AITutor />
      <BottomNav />
    </div>
  );
};

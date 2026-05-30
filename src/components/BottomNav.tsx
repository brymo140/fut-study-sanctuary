import { NavLink, useLocation } from "react-router-dom";
import { Home, Search, Play, Download, User } from "lucide-react";

// Saved tab merged into Downloads. Five-item bottom nav.
const items = [
  { to: "/", label: "Home", icon: Home, onboard: "" },
  { to: "/browse", label: "Browse", icon: Search, onboard: "browse" },
  { to: "/watch", label: "Watch", icon: Play, onboard: "watch" },
  { to: "/downloads", label: "Library", icon: Download, onboard: "downloads" },
  { to: "/profile", label: "Profile", icon: User },
];

export const BottomNav = () => {
  const location = useLocation();
  return (
    <nav
      className="fixed left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur-md rounded-[24px]"
      style={{
        bottom: "calc(var(--banner-height) + var(--sab))",
        paddingBottom: "0px",
        left: '16px',
        right: '16px',
        width: 'auto',
        borderRadius: '24px'
}}
    >
      <div className="app-shell">
        <ul className="grid grid-cols-5">
          {items.map(({ to, label, icon: Icon, onboard }) => {
            const active =
              to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
            return (
              <li key={to}>
                <NavLink
                  to={to}
                  data-onboarding={onboard || undefined}
                  className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-xl text-[10px] font-medium transition-colors ${
                    active ? "text-primary bg-primary/15" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  }`}
                >
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                  <span>{label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
};

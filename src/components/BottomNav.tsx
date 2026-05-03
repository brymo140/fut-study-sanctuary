import { NavLink, useLocation } from "react-router-dom";
import { Home, Search, Play, Download, User } from "lucide-react";

// Saved tab merged into Downloads. Five-item bottom nav.
const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/browse", label: "Browse", icon: Search },
  { to: "/watch", label: "Watch", icon: Play },
  { to: "/downloads", label: "Library", icon: Download },
  { to: "/profile", label: "Profile", icon: User },
];

export const BottomNav = () => {
  const location = useLocation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur-md">
      <div className="app-shell">
        <ul className="grid grid-cols-5">
          {items.map(({ to, label, icon: Icon }) => {
            const active =
              to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
            return (
              <li key={to}>
                <NavLink
                  to={to}
                  className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
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

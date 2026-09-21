import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Compass, Grid3X3, Settings } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { useMemo } from "react";

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const baseNavItems: NavItem[] = [
  { path: "/", label: "Discover", icon: Compass },
  { path: "/categories", label: "Categories", icon: Grid3X3 },
];

export function BottomNav() {
  const location = useLocation();
  const { data: settings } = useSettings();

  const navItems = useMemo(() => {
    const items = [...baseNavItems];
    if (settings?.nav_visibility?.admin) {
      items.push({ path: "/admin", label: "Admin", icon: Settings });
    }
    return items;
  }, [settings]);

  return (
    <nav className="bottom-nav safe-bottom z-50">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path !== "/" && location.pathname.startsWith(item.path));
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`bottom-nav-item relative flex-1 ${isActive ? "active" : ""}`}
            >
              <div className="relative">
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute -inset-2 bg-primary/10 rounded-xl"
                    initial={false}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
                <Icon className={`h-6 w-6 relative z-10 ${isActive ? "text-primary" : ""}`} />
              </div>
              <span className={`text-xs mt-1 font-medium ${isActive ? "text-primary" : ""}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Map, 
  ScanSearch, 
  BellRing, 
  FileText, 
  Database,
  Settings,
  ChevronLeft,
  Leaf
} from "lucide-react";

interface SidebarProps {
  isCollapsed?: boolean;
  isMobile?: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
}

export default function AppSidebar({ isCollapsed = false, isMobile = false, onToggle, onNavigate }: SidebarProps) {
  const pathname = usePathname();

  const navItems = [
    { 
      label: "Dashboard", 
      href: "/dashboard", 
      icon: LayoutDashboard,
      description: "Satellite Command Center"
    },
    { 
      label: "Map View", 
      href: "/map", 
      icon: Map,
      description: "3D Globe & Maps"
    },
    { 
      label: "Change Detection", 
      href: "/analyze", 
      icon: ScanSearch,
      description: "New Scan & Analysis"
    },
    { 
      label: "Alerts", 
      href: "/alerts", 
      icon: BellRing,
      description: "Active Monitoring Rules",
      badge: 3 // TODO: Get from API
    },
    { 
      label: "Reports", 
      href: "/reports", 
      icon: FileText,
      description: "Forensic Reports"
    },
    { 
      label: "Data & Sources", 
      href: "/data-sources", 
      icon: Database,
      description: "Uploaded Images"
    },
    { 
      label: "Settings", 
      href: "/settings", 
      icon: Settings,
      description: "Preferences & Config"
    },
  ];

  return (
    <aside className={`app-sidebar fixed left-0 top-0 z-40 flex h-full flex-col transition-all duration-300 ease-in-out ${isMobile ? 'w-64' : (isCollapsed ? 'w-16' : 'w-64')} lg:translate-x-0`}
      style={isMobile ? { transform: isCollapsed ? "translateX(-100%)" : "translateX(0)" } : undefined}
    >
      {/* Header */}
      <div className="app-sidebar-header flex h-16 items-center justify-between px-4">
        {!isCollapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="app-sidebar-mark flex h-8 w-8 items-center justify-center rounded-lg">
              <Leaf className="h-4 w-4" />
            </div>
            <div>
              <div className="app-sidebar-title font-display text-sm font-bold">
                Terra<span>Trace</span>
              </div>
              <div className="app-sidebar-tagline text-[9px] font-mono tracking-wider">
                MONITOR • DETECT • PROTECT
              </div>
            </div>
          </Link>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-label={isMobile ? "Close navigation menu" : isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="app-sidebar-toggle flex h-11 w-11 items-center justify-center rounded-md transition-colors focus-visible:outline focus-visible:outline-2"
        >
          <ChevronLeft 
            className={`h-4 w-4 transition-transform ${
              isCollapsed ? 'rotate-180' : ''
            }`} 
          />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={`
                  app-sidebar-link group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200
                  ${isActive ? 'active' : ''}
                `}
              >
                <Icon className={`h-5 w-5 flex-shrink-0 ${
                  isActive ? 'app-sidebar-link-icon active' : 'app-sidebar-link-icon'
                }`} />
                
                {!isCollapsed && (
                  <>
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{item.label}</div>
                      <div className="app-sidebar-description text-xs truncate">
                        {item.description}
                      </div>
                    </div>
                    
                    {item.badge && (
                      <span className="app-sidebar-badge flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
                
                {isCollapsed && item.badge && (
                  <span className="app-sidebar-dot absolute -right-1 -top-1 h-3 w-3 rounded-full"></span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      {!isCollapsed && (
        <div className="app-sidebar-footer border-t p-4">
          <div className="app-sidebar-mission relative overflow-hidden rounded-xl p-4">
            {/* Background forest image overlay */}
            <div className="absolute inset-0 opacity-10">
              <div className="h-full w-full bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            </div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <Leaf className="app-sidebar-mission-icon h-4 w-4" />
                <span className="app-sidebar-mission-label text-xs font-mono font-semibold">
                  OUR MISSION
                </span>
              </div>
              <div className="app-sidebar-mission-copy text-xs leading-relaxed">
                <div>Healthier Forests</div>
                <div>Safer Communities</div>
                <div>A Greener Tomorrow</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

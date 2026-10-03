"use client";

import { useState, useEffect } from "react";
import AppSidebar from "./AppSidebar";
import TopBar from "./TopBar";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      // Auto-collapse on smaller screens
      if (window.innerWidth < 1280) {
        setIsSidebarCollapsed(true);
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const handleSidebarToggle = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  return (
    <div className="min-h-screen bg-transparent">
      <AppSidebar
        isCollapsed={isSidebarCollapsed} 
        isMobile={isMobile}
        onToggle={handleSidebarToggle}
        onNavigate={() => { if (isMobile) setIsSidebarCollapsed(true); }}
      />
      
      <div className={`
        transition-all duration-300 ease-in-out
        ${isSidebarCollapsed ? 'ml-16' : 'ml-64'}
        ${isMobile ? 'ml-0' : ''}
      `}>
        <TopBar onSidebarToggle={handleSidebarToggle} />
        
        <main className="min-h-[calc(100vh-4rem)]">
          {children}
        </main>
      </div>

      {/* Mobile overlay when sidebar is open */}
      {isMobile && !isSidebarCollapsed && (
        <div 
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setIsSidebarCollapsed(true)}
        />
      )}
    </div>
  );
}
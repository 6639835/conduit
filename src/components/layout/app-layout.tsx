"use client";

import * as React from "react";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { Footer } from "./footer";
import { cn } from "@/lib/utils/cn";

interface AppLayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
}

export const AppLayout = ({ children, showSidebar = true }: AppLayoutProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);
  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="min-h-screen flex flex-col">
      <Header onMenuToggle={toggleSidebar} isMenuOpen={isSidebarOpen} />

      <div className="flex flex-1 pt-16">
        {showSidebar && (
          <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} />
        )}

        <main
          className={cn(
            "flex-1 transition-all duration-300",
            showSidebar && "md:ml-64"
          )}
        >
          <div className="p-4 md:p-6 lg:p-8">{children}</div>
        </main>
      </div>

      <div className={cn(showSidebar && "md:ml-64")}>
        <Footer />
      </div>
    </div>
  );
};

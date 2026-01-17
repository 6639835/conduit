"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import {
  BarChart3,
  Key,
  LayoutDashboard,
  Users,
  Activity,
  Search,
  Gauge,
  Server,
  FileText,
  Bell,
  Shield,
} from "lucide-react";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const userNavItems: NavItem[] = [
  { label: "Dashboard", href: "/usage", icon: LayoutDashboard },
  { label: "Usage", href: "/usage#usage", icon: Activity },
  { label: "Quota", href: "/usage#quota", icon: Gauge },
  { label: "Search", href: "/usage#search", icon: Search },
];

const adminNavItems: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "API Keys", href: "/admin/keys", icon: Key },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { label: "Providers", href: "/admin/providers", icon: Server },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Request Logs", href: "/admin/logs", icon: FileText },
  { label: "Audit Logs", href: "/admin/audit", icon: Shield },
  { label: "System Status", href: "/admin/status", icon: Activity },
  { label: "Notifications", href: "/admin/notifications", icon: Bell },
];

export const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");
  const navItems = isAdmin ? adminNavItems : userNavItems;

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-16 z-30 h-[calc(100vh-4rem)] w-64 border-r border-border bg-background transition-transform duration-300 ease-in-out md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <nav className="flex flex-col gap-1 p-4">
          <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {isAdmin ? "Admin Panel" : "User Dashboard"}
          </p>

          {navItems.map((item) => {
            const Icon = item.icon;
            const itemPath = item.href.split("#")[0];
            const isActive =
              pathname === itemPath ||
              (itemPath !== "/admin" &&
                itemPath !== "/usage" &&
                pathname?.startsWith(itemPath));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
};

"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { Menu, X, Zap } from "lucide-react";
import { Button } from "../ui/button";

interface HeaderProps {
  onMenuToggle?: () => void;
  isMenuOpen?: boolean;
}

export const Header = ({ onMenuToggle, isMenuOpen }: HeaderProps) => {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onMenuToggle}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>

          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
              <Zap className="h-5 w-5 text-accent-foreground" />
            </div>
            <span className="font-semibold text-xl">Conduit</span>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <nav className="hidden md:flex items-center gap-1">
            <Link
              href="/usage"
              className={cn(
                "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                pathname === "/usage"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              Usage
            </Link>
            <Link
              href="/admin"
              className={cn(
                "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isAdmin
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              Admin
            </Link>
          </nav>

          <div className="h-6 w-px bg-border hidden md:block" />

          <div
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium",
              isAdmin
                ? "bg-accent/10 text-accent"
                : "bg-muted text-muted-foreground"
            )}
          >
            <span className={cn(
              "h-2 w-2 rounded-full",
              isAdmin ? "bg-accent" : "bg-muted-foreground"
            )} />
            {isAdmin ? "Admin" : "User"}
          </div>
        </div>
      </div>
    </header>
  );
};

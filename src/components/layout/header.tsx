"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { Menu, X, Zap } from "lucide-react";
import { Button } from "../ui/button";
import { UserMenu } from "./user-menu";
import { NotificationsDropdown } from "./notifications-dropdown";

interface HeaderProps {
  onMenuToggle?: () => void;
  isMenuOpen?: boolean;
}

export const Header = ({ onMenuToggle, isMenuOpen }: HeaderProps) => {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");

  return (
    <header className="fixed top-0 left-0 right-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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
          {isAdmin && <NotificationsDropdown />}

          <UserMenu />
        </div>
      </div>
    </header>
  );
};

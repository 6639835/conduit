import * as React from "react";
import Link from "next/link";

export const Footer = () => {
  return (
    <footer className="border-t border-border bg-background py-6 px-4 md:px-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Conduit API Gateway</span>
          <span className="hidden md:inline">|</span>
          <span className="text-xs">v1.0.0</span>
        </div>

        <nav className="flex items-center gap-6">
          <Link
            href="/docs"
            className="hover:text-foreground transition-colors"
          >
            Documentation
          </Link>
          <Link
            href="/privacy"
            className="hover:text-foreground transition-colors"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="hover:text-foreground transition-colors"
          >
            Terms
          </Link>
        </nav>

        <p className="text-xs">
          &copy; {new Date().getFullYear()} Conduit. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

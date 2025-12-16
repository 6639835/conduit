"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      theme="system"
      richColors
      expand={true}
      closeButton
      duration={5000}
    />
  );
}

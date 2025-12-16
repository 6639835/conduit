"use client";

import * as React from "react";
import { toast as sonnerToast } from "sonner";

type ToastVariant = "success" | "error" | "warning" | "info";

interface Toast {
  title: string;
  description?: string;
  variant: ToastVariant;
  duration?: number;
}

export const useToast = () => {
  const addToast = React.useCallback((toast: Toast) => {
    const duration = toast.duration || 5000;

    switch (toast.variant) {
      case "success":
        sonnerToast.success(toast.title, {
          description: toast.description,
          duration,
        });
        break;
      case "error":
        sonnerToast.error(toast.title, {
          description: toast.description,
          duration,
        });
        break;
      case "warning":
        sonnerToast.warning(toast.title, {
          description: toast.description,
          duration,
        });
        break;
      case "info":
        sonnerToast.info(toast.title, {
          description: toast.description,
          duration,
        });
        break;
    }
  }, []);

  return { addToast };
};

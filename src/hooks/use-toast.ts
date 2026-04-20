import { toast as sonnerToast } from "sonner";

export type ToastVariant = "default" | "destructive" | "success" | "warning" | "info";

export interface ToastOptions {
  title?: string;
  description?: string;
  variant?: ToastVariant;
}

function toast({ title, description, variant = "default" }: ToastOptions) {
  const message = title || description || "";
  const options = description && title ? { description } : undefined;

  switch (variant) {
    case "destructive":
      return sonnerToast.error(message, options);
    case "success":
      return sonnerToast.success(message, options);
    case "warning":
      return sonnerToast.warning(message, options);
    case "info":
      return sonnerToast.info(message, options);
    default:
      return sonnerToast(message, options);
  }
}

const toastApi = { toast };

export function useToast() {
  return toastApi;
}

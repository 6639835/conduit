import { toast as sonnerToast } from "sonner";

export type ToastVariant = "default" | "destructive" | "success" | "warning" | "info";

export interface ToastOptions {
  title?: string;
  description?: string;
  variant?: ToastVariant;
}

export function useToast() {
  return {
    toast: ({ title, description, variant = "default" }: ToastOptions) => {
      const message = title || description || "";
      const options = description && title ? { description } : undefined;

      switch (variant) {
        case "destructive":
          sonnerToast.error(message, options);
          break;
        case "success":
          sonnerToast.success(message, options);
          break;
        case "warning":
          sonnerToast.warning(message, options);
          break;
        case "info":
          sonnerToast.info(message, options);
          break;
        default:
          sonnerToast(message, options);
          break;
      }
    },
  };
}

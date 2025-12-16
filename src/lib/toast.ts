import { toast as sonnerToast } from 'sonner';

/**
 * Toast utility with built-in deduplication to prevent spam
 *
 * This wrapper prevents showing duplicate toasts within a short time window,
 * which can happen when multiple API calls fail simultaneously or when users
 * rapidly trigger actions.
 */

// Track recent toasts to prevent duplicates
const recentToasts = new Map<string, number>();
const DEDUPE_WINDOW = 3000; // 3 seconds

function shouldShowToast(key: string): boolean {
  const now = Date.now();
  const lastShown = recentToasts.get(key);

  if (lastShown && now - lastShown < DEDUPE_WINDOW) {
    return false; // Toast was shown recently, skip it
  }

  recentToasts.set(key, now);

  // Clean up old entries
  if (recentToasts.size > 50) {
    const oldestAllowed = now - DEDUPE_WINDOW;
    for (const [k, timestamp] of recentToasts.entries()) {
      if (timestamp < oldestAllowed) {
        recentToasts.delete(k);
      }
    }
  }

  return true;
}

function createToastKey(message: string, description?: string): string {
  return `${message}::${description || ''}`;
}

export const toast = {
  success: (message: string, options?: { description?: string; duration?: number }) => {
    const key = createToastKey(message, options?.description);
    if (shouldShowToast(key)) {
      return sonnerToast.success(message, options);
    }
  },

  error: (message: string, options?: { description?: string; duration?: number }) => {
    const key = createToastKey(message, options?.description);
    if (shouldShowToast(key)) {
      return sonnerToast.error(message, options);
    }
  },

  warning: (message: string, options?: { description?: string; duration?: number }) => {
    const key = createToastKey(message, options?.description);
    if (shouldShowToast(key)) {
      return sonnerToast.warning(message, options);
    }
  },

  info: (message: string, options?: { description?: string; duration?: number }) => {
    const key = createToastKey(message, options?.description);
    if (shouldShowToast(key)) {
      return sonnerToast.info(message, options);
    }
  },

  loading: (message: string, options?: { description?: string; duration?: number }) => {
    const key = createToastKey(message, options?.description);
    if (shouldShowToast(key)) {
      return sonnerToast.loading(message, options);
    }
  },

  // For cases where you explicitly want to show the toast regardless of deduplication
  force: sonnerToast,
};

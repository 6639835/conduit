import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { AlertCircle, CheckCircle } from "lucide-react";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  success?: boolean;
  label?: string;
  helpText?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, success, label, id, helpText, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    const hasError = !!error;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="mb-2 block text-sm font-medium text-foreground"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <input
            type={type}
            id={inputId}
            className={cn(
              "flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
              hasError && "border-destructive focus-visible:ring-destructive",
              success && "border-success focus-visible:ring-success",
              (hasError || success) && "pr-10",
              className
            )}
            ref={ref}
            {...props}
          />
          {hasError && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <AlertCircle className="h-5 w-5 text-destructive" />
            </div>
          )}
          {success && !hasError && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <CheckCircle className="h-5 w-5 text-success" />
            </div>
          )}
        </div>
        {hasError && (
          <p className="mt-1 text-sm text-destructive">{error}</p>
        )}
        {!hasError && helpText && (
          <p className="mt-1 text-sm text-muted-foreground">{helpText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };

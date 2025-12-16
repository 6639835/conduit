import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { LucideIcon } from "lucide-react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "outlined";
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl transition-shadow",
          variant === "default" &&
            "bg-background shadow-md border border-border",
          variant === "outlined" && "border border-border",
          className
        )}
        {...props}
      />
    );
  }
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-2xl font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

// Specialized Card Components

interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

const MetricCard = ({
  title,
  value,
  description,
  icon: Icon,
  trend,
  className,
}: MetricCardProps) => {
  return (
    <Card className={cn("p-6", className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <h2 className="text-3xl font-bold">{value}</h2>
            {trend && (
              <span
                className={cn(
                  "text-sm font-medium",
                  trend.isPositive ? "text-success" : "text-destructive"
                )}
              >
                {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
              </span>
            )}
          </div>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {Icon && (
          <div className="rounded-lg bg-muted p-3">
            <Icon className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
      </div>
    </Card>
  );
};

interface UsageCardProps {
  title: string;
  used: number;
  total: number;
  unit?: string;
  className?: string;
}

const UsageCard = ({
  title,
  used,
  total,
  unit = "",
  className,
}: UsageCardProps) => {
  const percentage = total > 0 ? (used / total) * 100 : 0;
  const isOverLimit = used > total;

  return (
    <Card className={cn("p-6", className)}>
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <div className="mt-2">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold">
            {used.toLocaleString()}
          </span>
          <span className="text-sm text-muted-foreground">
            / {total.toLocaleString()} {unit}
          </span>
        </div>
        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full transition-all",
                isOverLimit ? "bg-destructive" : "bg-success"
              )}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {percentage.toFixed(1)}% used
          </p>
        </div>
      </div>
    </Card>
  );
};

interface AlertCardProps {
  title: string;
  description: string;
  variant?: "info" | "warning" | "error" | "success";
  className?: string;
}

const AlertCard = ({
  title,
  description,
  variant = "info",
  className,
}: AlertCardProps) => {
  const variantStyles = {
    info: "border-accent bg-accent/5",
    warning: "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/10",
    error: "border-destructive bg-destructive/5",
    success: "border-success bg-success/5",
  };

  return (
    <Card
      variant="outlined"
      className={cn("border-l-4 p-4", variantStyles[variant], className)}
    >
      <h4 className="font-semibold">{title}</h4>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </Card>
  );
};

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  MetricCard,
  UsageCard,
  AlertCard,
};

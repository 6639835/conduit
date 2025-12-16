import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { Card } from "./card";

type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

const Skeleton = ({ className, ...props }: SkeletonProps) => {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-muted",
        className
      )}
      {...props}
    />
  );
};

// Specialized Skeleton Components

const SkeletonCard = () => {
  return (
    <Card className="p-6">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-4 h-8 w-32" />
      <Skeleton className="mt-2 h-3 w-40" />
    </Card>
  );
};

const SkeletonMetricCard = () => {
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-4 h-10 w-28" />
          <Skeleton className="mt-2 h-3 w-32" />
        </div>
        <Skeleton className="h-12 w-12 rounded-lg" />
      </div>
    </Card>
  );
};

const SkeletonTable = ({ rows = 5 }: { rows?: number }) => {
  return (
    <div className="space-y-3">
      <div className="flex gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-10 flex-1" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4">
            {[1, 2, 3, 4].map((j) => (
              <Skeleton key={j} className="h-12 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

const SkeletonChart = () => {
  return (
    <Card className="p-6">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="mt-6 h-64 w-full" />
      <div className="mt-4 flex justify-center gap-4">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-20" />
      </div>
    </Card>
  );
};

export { Skeleton, SkeletonCard, SkeletonMetricCard, SkeletonTable, SkeletonChart };

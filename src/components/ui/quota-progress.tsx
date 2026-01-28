'use client';

import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

export interface QuotaData {
  used: number;
  limit: number;
  label: string;
  unit?: string;
}

interface QuotaProgressProps {
  quota: QuotaData;
  showWarnings?: boolean;
}

function getQuotaColor(percentage: number): {
  bg: string;
  text: string;
  border: string;
  bar: string;
} {
  if (percentage >= 100) {
    return {
      bg: 'bg-destructive/10',
      text: 'text-destructive',
      border: 'border-destructive',
      bar: 'bg-destructive',
    };
  } else if (percentage >= 90) {
    return {
      bg: 'bg-orange-500/10',
      text: 'text-orange-600',
      border: 'border-orange-500',
      bar: 'bg-orange-500',
    };
  } else if (percentage >= 80) {
    return {
      bg: 'bg-yellow-500/10',
      text: 'text-yellow-600',
      border: 'border-yellow-500',
      bar: 'bg-yellow-500',
    };
  } else if (percentage >= 50) {
    return {
      bg: 'bg-blue-500/10',
      text: 'text-blue-600',
      border: 'border-blue-500',
      bar: 'bg-blue-500',
    };
  }
  return {
    bg: 'bg-success/10',
    text: 'text-success',
    border: 'border-success',
    bar: 'bg-success',
  };
}

function getStatusIcon(percentage: number) {
  if (percentage >= 100) {
    return <XCircle className="h-4 w-4" />;
  } else if (percentage >= 80) {
    return <AlertTriangle className="h-4 w-4" />;
  }
  return <CheckCircle className="h-4 w-4" />;
}

function formatNumber(num: number, unit?: string): string {
  if (!unit || unit === 'tokens') {
    return num.toLocaleString();
  }
  if (unit === 'usd') {
    return `$${num.toFixed(2)}`;
  }
  return num.toLocaleString();
}

export function QuotaProgress({ quota, showWarnings = true }: QuotaProgressProps) {
  const percentage = quota.limit > 0 ? (quota.used / quota.limit) * 100 : 0;
  const colors = getQuotaColor(percentage);
  const remaining = Math.max(0, quota.limit - quota.used);

  return (
    <div className={`rounded-lg border p-4 ${colors.bg} ${colors.border}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`font-medium ${colors.text}`}>{quota.label}</span>
          {showWarnings && <span className={colors.text}>{getStatusIcon(percentage)}</span>}
        </div>
        <div className="text-sm font-mono">
          <span className={colors.text}>
            {formatNumber(quota.used, quota.unit)} / {formatNumber(quota.limit, quota.unit)}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative w-full h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`absolute top-0 left-0 h-full ${colors.bar} transition-all duration-300`}
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>

      {/* Status Text */}
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-muted-foreground">
          {formatNumber(remaining, quota.unit)} remaining
        </span>
        <span className={`text-xs font-medium ${colors.text}`}>
          {percentage.toFixed(1)}%
        </span>
      </div>

      {/* Warning Messages */}
      {showWarnings && percentage >= 80 && (
        <div className={`mt-3 pt-3 border-t ${colors.border}`}>
          <p className={`text-xs ${colors.text}`}>
            {percentage >= 100 && '⛔ Quota exceeded - requests will be blocked'}
            {percentage >= 90 && percentage < 100 && '⚠️ Approaching limit - consider upgrading'}
            {percentage >= 80 && percentage < 90 && '📊 80% quota used - monitor usage'}
          </p>
        </div>
      )}
    </div>
  );
}

interface QuotaGridProps {
  quotas: QuotaData[];
  showWarnings?: boolean;
}

export function QuotaGrid({ quotas, showWarnings = true }: QuotaGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {quotas.map((quota, index) => (
        <QuotaProgress key={index} quota={quota} showWarnings={showWarnings} />
      ))}
    </div>
  );
}

interface QuotaSummaryProps {
  requestsPerMinute?: { used: number; limit: number };
  requestsPerDay?: { used: number; limit: number };
  tokensPerDay?: { used: number; limit: number };
  monthlySpend?: { used: number; limit: number };
}

export function QuotaSummary({
  requestsPerMinute,
  requestsPerDay,
  tokensPerDay,
  monthlySpend,
}: QuotaSummaryProps) {
  const quotas: QuotaData[] = [];

  if (requestsPerMinute) {
    quotas.push({
      used: requestsPerMinute.used,
      limit: requestsPerMinute.limit,
      label: 'Requests/Minute',
      unit: 'requests',
    });
  }

  if (requestsPerDay) {
    quotas.push({
      used: requestsPerDay.used,
      limit: requestsPerDay.limit,
      label: 'Requests/Day',
      unit: 'requests',
    });
  }

  if (tokensPerDay) {
    quotas.push({
      used: tokensPerDay.used,
      limit: tokensPerDay.limit,
      label: 'Tokens/Day',
      unit: 'tokens',
    });
  }

  if (monthlySpend) {
    quotas.push({
      used: monthlySpend.used,
      limit: monthlySpend.limit,
      label: 'Monthly Spend',
      unit: 'usd',
    });
  }

  if (quotas.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No quota information available
      </div>
    );
  }

  return <QuotaGrid quotas={quotas} />;
}

'use client';

import { useState, ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';

interface HelpTooltipProps {
  content: string | ReactNode;
  title?: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  icon?: ReactNode;
}

export function HelpTooltip({
  content,
  title,
  placement = 'top',
  icon,
}: HelpTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  const placementClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent',
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
      >
        {icon || <HelpCircle className="h-4 w-4" />}
      </button>

      {isVisible && (
        <div
          className={`absolute ${placementClasses[placement]} z-50 w-64 animate-in fade-in-0 zoom-in-95 duration-200`}
        >
          <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
            {title && (
              <div className="font-medium text-sm mb-1">{title}</div>
            )}
            <div className="text-xs text-muted-foreground leading-relaxed">
              {content}
            </div>
          </div>
          <div
            className={`absolute ${arrowClasses[placement]} w-0 h-0 border-4 border-popover`}
          />
        </div>
      )}
    </div>
  );
}

interface HelpTextProps {
  children: ReactNode;
  help: string | ReactNode;
  title?: string;
}

export function HelpText({ children, help, title }: HelpTextProps) {
  return (
    <span className="inline-flex items-center gap-1">
      {children}
      <HelpTooltip content={help} title={title} />
    </span>
  );
}

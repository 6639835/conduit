import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { ChevronDown } from "lucide-react";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  onValueChange?: (value: string) => void;
}

export interface SelectItemProps {
  value: string;
  disabled?: boolean;
  children: React.ReactNode;
}

const SelectItem = (_props: SelectItemProps) => null;
SelectItem.displayName = "SelectItem";

const SelectContent = (_props: React.HTMLAttributes<HTMLDivElement>) => null;
SelectContent.displayName = "SelectContent";

const SelectTrigger = (_props: React.HTMLAttributes<HTMLDivElement>) => null;
SelectTrigger.displayName = "SelectTrigger";

export interface SelectValueProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  placeholder?: string;
}

const SelectValue = (_props: SelectValueProps) => null;
SelectValue.displayName = "SelectValue";

type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type SelectMetadata = {
  placeholder?: string;
  triggerClassName?: string;
  hasCompositeChildren: boolean;
};

function extractText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractText).join("");
  }
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode };
    return extractText(props.children);
  }
  return "";
}

function collectSelectItems(children: React.ReactNode): SelectOption[] {
  const items: SelectOption[] = [];

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;

    if (child.type === SelectItem) {
      const props = child.props as SelectItemProps;
      items.push({
        value: props.value,
        disabled: props.disabled,
        label: extractText(props.children),
      });
      return;
    }

    const props = child.props as { children?: React.ReactNode };
    if (props.children) {
      items.push(...collectSelectItems(props.children));
    }
  });

  return items;
}

function collectSelectMetadata(children: React.ReactNode): SelectMetadata {
  const metadata: SelectMetadata = {
    hasCompositeChildren: false,
  };

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;

    if (child.type === SelectTrigger) {
      metadata.hasCompositeChildren = true;
      const props = child.props as { children?: React.ReactNode; className?: string };
      metadata.triggerClassName = cn(metadata.triggerClassName, props.className);
      const childMetadata = collectSelectMetadata(props.children);
      metadata.placeholder ??= childMetadata.placeholder;
      metadata.hasCompositeChildren ||= childMetadata.hasCompositeChildren;
      return;
    }

    if (child.type === SelectContent) {
      metadata.hasCompositeChildren = true;
      const props = child.props as { children?: React.ReactNode };
      const childMetadata = collectSelectMetadata(props.children);
      metadata.placeholder ??= childMetadata.placeholder;
      metadata.hasCompositeChildren ||= childMetadata.hasCompositeChildren;
      return;
    }

    if (child.type === SelectValue) {
      metadata.hasCompositeChildren = true;
      const props = child.props as SelectValueProps;
      metadata.placeholder = props.placeholder;
      return;
    }

    if (child.type === SelectItem) {
      metadata.hasCompositeChildren = true;
      return;
    }

    const props = child.props as { children?: React.ReactNode };
    if (props.children) {
      const childMetadata = collectSelectMetadata(props.children);
      metadata.placeholder ??= childMetadata.placeholder;
      metadata.hasCompositeChildren ||= childMetadata.hasCompositeChildren;
    }
  });

  return metadata;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      label,
      error,
      id,
      children,
      onValueChange,
      onChange,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const selectId = id || generatedId;
    const hasError = !!error;
    const options = collectSelectItems(children);
    const { placeholder, triggerClassName, hasCompositeChildren } =
      collectSelectMetadata(children);
    const shouldRenderCompositeOptions = hasCompositeChildren || options.length > 0;
    const shouldRenderPlaceholder =
      !!placeholder && !options.some((option) => option.value === "");

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="mb-2 block text-sm font-medium text-foreground"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            id={selectId}
            className={cn(
              "flex h-10 w-full appearance-none rounded-lg border border-border bg-background px-3 py-2 pr-10 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
              hasError && "border-destructive focus-visible:ring-destructive",
              triggerClassName,
              className
            )}
            ref={ref}
            onChange={(event) => {
              onValueChange?.(event.target.value);
              onChange?.(event);
            }}
            {...props}
          >
            {shouldRenderCompositeOptions ? (
              <>
                {shouldRenderPlaceholder && (
                  <option value="" disabled>
                    {placeholder}
                  </option>
                )}
                {options.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled}
                  >
                    {option.label}
                  </option>
                ))}
              </>
            ) : (
              children
            )}
          </select>
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
        {hasError && (
          <p className="mt-1 text-sm text-destructive">{error}</p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };

import type { ReactNode } from "react";

export function StylePopover({
  className,
  title,
  children,
}: {
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className={`style-popover${className ? ` ${className}` : ""}`}>
      {title ? <div className="style-popover__title">{title}</div> : null}
      {children}
    </div>
  );
}

export function SegmentedModes<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string; icon?: ReactNode }>;
  value: T | "mixed";
  onChange: (value: T) => void;
}) {
  return (
    <div className="style-popover__modes" role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          className={`style-popover__mode${value === option.value ? " is-active" : ""}${value === "mixed" ? " is-mixed" : ""}`}
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.icon ? <span className="style-popover__mode-icon">{option.icon}</span> : null}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}

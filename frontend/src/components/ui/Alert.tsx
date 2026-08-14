import * as React from 'react';

type AlertVariant = 'default' | 'success' | 'info' | 'warning' | 'error';

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
  onClose?: () => void;
}

const variantClassMap: Record<AlertVariant, string> = {
  default: 'border-[var(--arcane-border-light)] bg-[var(--arcane-paper)] text-[var(--arcane-ink-900)]',
  success: 'border-[var(--arcane-success-border)] bg-[var(--arcane-success-soft)] text-[var(--arcane-success-text)]',
  info: 'border-[var(--arcane-info-border)] bg-[var(--arcane-info-soft)] text-[var(--arcane-info-text)]',
  warning: 'border-[var(--arcane-warning-border)] bg-[var(--arcane-warning-soft)] text-[var(--arcane-warning-text)]',
  error: 'border-[var(--arcane-danger-border)] bg-[var(--arcane-danger-soft)] text-[var(--arcane-danger-text)]',
};

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className = '', variant = 'default', title, children, onClose, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="status"
        aria-live="polite"
        className={`rounded-lg border p-3 text-sm ${variantClassMap[variant]} ${className}`}
        {...props}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? <p className="font-semibold leading-5">{title}</p> : null}
            {children ? <div className={title ? 'mt-1' : ''}>{children}</div> : null}
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-current/70 hover:bg-black/10 hover:text-current"
              aria-label="Dismiss alert"
            >
              ×
            </button>
          ) : null}
        </div>
      </div>
    );
  }
);

Alert.displayName = 'Alert';

export default Alert;
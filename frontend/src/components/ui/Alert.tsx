import * as React from 'react';

type AlertVariant = 'default' | 'success' | 'info' | 'warning' | 'error';

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
  onClose?: () => void;
}

const variantClassMap: Record<AlertVariant, string> = {
  default: 'border-gray-200 bg-gray-50 text-gray-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  info: 'border-blue-200 bg-blue-50 text-blue-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  error: 'border-red-200 bg-red-50 text-red-800',
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
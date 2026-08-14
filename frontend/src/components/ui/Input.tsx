import * as React from 'react';

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  clearable?: boolean;
  onClear?: () => void;
  clearAriaLabel?: string;
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, clearable = false, onClear, clearAriaLabel = 'Clear input', onChange, value, defaultValue, disabled, readOnly, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    const setRefs = (node: HTMLInputElement | null) => {
      inputRef.current = node;

      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    };

    const valueAsString = typeof value === 'string' ? value : '';
    const defaultValueAsString = typeof defaultValue === 'string' ? defaultValue : '';
    const hasValue = valueAsString.length > 0 || (!valueAsString && defaultValueAsString.length > 0);
    const showClear = clearable && hasValue && !disabled && !readOnly;

    const handleClear = () => {
      if (onClear) {
        onClear();
      } else if (onChange) {
        onChange({
          target: { value: '' },
          currentTarget: { value: '' },
        } as React.ChangeEvent<HTMLInputElement>);
      }

      inputRef.current?.focus();
    };

    const inputElement = (
      <input
        type={type}
        className={`flex h-10 w-full rounded-md border border-[var(--arcane-border-light)] bg-[var(--arcane-paper-raised)] px-3 py-2 text-sm text-[var(--arcane-ink-900)] placeholder:text-[var(--arcane-ink-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--arcane-gold-600)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${showClear ? 'pr-8' : ''} ${className ?? ''}`}
        ref={setRefs}
        onChange={onChange}
        value={value}
        defaultValue={defaultValue}
        disabled={disabled}
        readOnly={readOnly}
        {...props}
      />
    );

    if (!showClear) {
      return inputElement;
    }

    return (
      <div className="relative">
        {inputElement}
        <button
          type="button"
          aria-label={clearAriaLabel}
          onMouseDown={(event) => event.preventDefault()}
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-5 w-5 items-center justify-center rounded text-[var(--arcane-ink-soft)] transition hover:bg-[#e2d5bd99] hover:text-[var(--arcane-ink-900)]"
        >
          x
        </button>
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };

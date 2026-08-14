import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronsUpDown, X } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface Props {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  disablePortal?: boolean;
  tabIndex?: number;
  autoFocus?: boolean;
  openOnFocus?: boolean;
}

const normalizeOptionValue = (value: string | number | null | undefined) => String(value ?? '').trim().toLowerCase();

const ComboSelect: React.FC<Props> = ({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  className,
  triggerClassName,
  disablePortal = false,
  tabIndex,
  autoFocus = false,
  openOnFocus = false,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const ref = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const dropdownRef = useRef<HTMLUListElement | null>(null);
  const listboxId = React.useId();

  const selectedOption = options.find((o) => normalizeOptionValue(o.value) === normalizeOptionValue(value)) ?? null;

  const recalcPosition = () => {
    if (disablePortal) {
      return;
    }
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 2,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
        // Radix modal dialogs set pointer-events:none on the body while open.
        // Re-enable it here so options portaled to the body remain clickable.
        pointerEvents: 'auto',
      });
    }
  };

  useEffect(() => {
    if (!open) {
      setSearch('');
    }
  }, [open]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      const clickedInsideInput = !!ref.current && ref.current.contains(target);
      const clickedInsideDropdown = !!dropdownRef.current && dropdownRef.current.contains(target);

      if (!clickedInsideInput && !clickedInsideDropdown) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // Reposition on scroll or resize so the portal stays aligned
  useEffect(() => {
    if (disablePortal) return;
    if (!open) return;
    const handleScroll = () => recalcPosition();
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [open, disablePortal]);

  const filtered = options.filter((o) =>
    o.label.trim().toLowerCase().includes(search.trim().toLowerCase())
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  }, [open]);

  useEffect(() => {
    if (!filtered.length) {
      setActiveIndex(0);
      return;
    }

    const selectedIndex = filtered.findIndex((opt) => normalizeOptionValue(opt.value) === normalizeOptionValue(value));
    if (selectedIndex >= 0) {
      setActiveIndex(selectedIndex);
      return;
    }

    setActiveIndex((current) => Math.min(current, filtered.length - 1));
  }, [filtered, value]);

  const handleSelect = (opt: Option) => {
    onChange(opt.value);
    setSearch('');
    setOpen(false);
    triggerRef.current?.focus();
  };

  const openDropdown = () => {
    setSearch('');
    if (!disablePortal) {
      recalcPosition();
    }
    setOpen(true);
  };

  const handleTriggerFocus = () => {
    if (openOnFocus) {
      openDropdown();
      return;
    }

    if (!disablePortal) {
      recalcPosition();
    }
  };

  const handleTriggerClick = () => {
    if (disabled) {
      return;
    }

    if (open) {
      setOpen(false);
      return;
    }

    openDropdown();
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
      }
      if (filtered.length) {
        setActiveIndex((current) => (current + 1) % filtered.length);
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
      }
      if (filtered.length) {
        setActiveIndex((current) => (current - 1 + filtered.length) % filtered.length);
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (!open) {
        openDropdown();
        return;
      }

      const option = filtered[activeIndex] ?? filtered[0];
      if (option) {
        handleSelect(option);
      }
      return;
    }

    if (e.key === ' ') {
      e.preventDefault();
      if (open) {
        setOpen(false);
      } else {
        openDropdown();
      }
      return;
    }

    if (e.key.length === 1 && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const initialSearch = e.key;

      if (!open) {
        if (!disablePortal) {
          recalcPosition();
        }
        setOpen(true);
      }

      setSearch(initialSearch);
      return;
    }

    if (e.key === 'Tab') {
      setOpen(false);
      return;
    }

    if (e.key === 'Escape') {
      setOpen(false);
      setSearch('');
    }
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (filtered.length) {
        setActiveIndex((current) => (current + 1) % filtered.length);
      }
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (filtered.length) {
        setActiveIndex((current) => (current - 1 + filtered.length) % filtered.length);
      }
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const option = filtered[activeIndex] ?? filtered[0];
      if (option) {
        handleSelect(option);
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setSearch('');
      triggerRef.current?.focus();
      return;
    }

    if (event.key === 'Tab') {
      if (search.trim()) {
        const option = filtered[activeIndex] ?? filtered[0];
        if (option) {
          handleSelect(option);
          return;
        }
      }

      setOpen(false);
      setSearch('');
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearch('');
    setOpen(false);
    triggerRef.current?.focus();
  };

  const dropdown = open && !disabled ? (
    <ul
      ref={dropdownRef}
      data-combo-select-portal="true"
      id={listboxId}
      role="listbox"
      style={disablePortal ? undefined : dropdownStyle}
      className={`bg-[var(--arcane-paper-raised)] border border-[var(--arcane-border-light)] rounded-md shadow-lg max-h-64 overflow-auto ${
        disablePortal ? 'absolute left-0 right-0 mt-1 z-50' : ''
      }`}
      onWheel={(e) => e.stopPropagation()}
    >
      <li className="p-2 border-b border-[var(--arcane-border-light)]">
        <input
          ref={searchInputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          aria-label="Search options"
          placeholder="Search..."
          className="w-full rounded-md border border-[var(--arcane-border-light)] bg-[var(--arcane-paper-raised)] px-3 py-2 text-sm text-[var(--arcane-ink-900)] focus:outline-none focus:ring-2 focus:ring-[var(--arcane-gold-600)]"
        />
      </li>
      {filtered.length === 0 ? (
        <li className="px-3 py-2 text-sm text-[var(--arcane-ink-soft)]">No matching items</li>
      ) : (
        filtered.map((opt, index) => {
          const isSelected = normalizeOptionValue(opt.value) === normalizeOptionValue(value);
          const isActive = filtered[activeIndex]?.value === opt.value;

          return (
            <li
              key={opt.value}
              id={`${listboxId}-option-${index}`}
              role="option"
              aria-selected={isSelected}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(opt);
              }}
              className={`px-3 py-2 text-sm cursor-pointer flex items-center gap-2 text-[var(--arcane-ink-900)] ${
                isActive ? 'bg-[var(--arcane-gold-soft)]' : 'hover:bg-[var(--arcane-paper)]'
              } ${isSelected ? 'font-medium' : ''}`}
            >
              <Check className={`h-4 w-4 ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
              <span>{opt.label}</span>
            </li>
          );
        })
      )}
    </ul>
  ) : null;

  return (
    <div className={`relative ${className ?? ''}`} ref={ref}>
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={handleTriggerClick}
          onKeyDown={handleTriggerKeyDown}
          onFocus={handleTriggerFocus}
          disabled={disabled}
          tabIndex={tabIndex}
          autoFocus={autoFocus}
          className={`w-full flex h-10 items-center justify-between rounded-md border border-[var(--arcane-border-light)] bg-[var(--arcane-paper-raised)] px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--arcane-gold-600)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${triggerClassName ?? ''}`}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-activedescendant={open && filtered[activeIndex] ? `${listboxId}-option-${activeIndex}` : undefined}
        >
          <span className={`truncate ${selectedOption ? 'text-[var(--arcane-ink-900)]' : 'text-[var(--arcane-ink-soft)]'}`}>
            {selectedOption?.label || (disabled ? 'Loading...' : placeholder)}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
        {value && !disabled ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-7 top-1/2 -translate-y-1/2 text-[var(--arcane-ink-soft)] hover:text-[var(--arcane-ink-900)]"
            tabIndex={-1}
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {disablePortal
        ? dropdown
        : typeof document !== 'undefined' && createPortal(dropdown, document.body)}
    </div>
  );
};

export default ComboSelect;

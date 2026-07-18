import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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
  disablePortal?: boolean;
  tabIndex?: number;
}

const ComboSelect: React.FC<Props> = ({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  className,
  disablePortal = false,
  tabIndex,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const ref = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dropdownRef = useRef<HTMLUListElement | null>(null);

  const selectedOption = options.find((o) => o.value === value) ?? null;

  const recalcPosition = () => {
    if (disablePortal) {
      return;
    }
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
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

  // When a value is selected from outside (e.g. reset), keep the search text in sync
  useEffect(() => {
    if (!open) {
      setSearch(selectedOption?.label ?? '');
    }
  }, [selectedOption, open]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      const clickedInsideInput = !!ref.current && ref.current.contains(target);
      const clickedInsideDropdown = !!dropdownRef.current && dropdownRef.current.contains(target);

      if (!clickedInsideInput && !clickedInsideDropdown) {
        setOpen(false);
        // Restore the label on blur-away so the input shows the selection
        setSearch(selectedOption?.label ?? '');
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [selectedOption]);

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
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    if (!filtered.length) {
      setActiveIndex(0);
      return;
    }

    const selectedIndex = filtered.findIndex((opt) => opt.value === value);
    if (selectedIndex >= 0) {
      setActiveIndex(selectedIndex);
      return;
    }

    setActiveIndex((current) => Math.min(current, filtered.length - 1));
  }, [filtered, value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setOpen(true);
    setActiveIndex(0);
    // Clear the stored value when the user starts typing something new
    if (value && e.target.value !== selectedOption?.label) {
      onChange('');
    }
  };

  const handleSelect = (opt: Option) => {
    onChange(opt.value);
    setSearch(opt.label);
    setOpen(false);
  };

  const handleInputFocus = () => {
    setSearch('');
    if (!disablePortal) {
      recalcPosition();
    }
    setOpen(true);
  };

  const handleInputBlur = () => {
    window.setTimeout(() => {
      const activeElement = document.activeElement;
      const focusInsideInput = !!ref.current && !!activeElement && ref.current.contains(activeElement);
      const focusInsideDropdown = !!dropdownRef.current && !!activeElement && dropdownRef.current.contains(activeElement);

      if (!focusInsideInput && !focusInsideDropdown) {
        setOpen(false);
        setSearch(selectedOption?.label ?? '');
      }
    }, 0);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
      if (!open) {
        return;
      }
      e.preventDefault();
      const option = filtered[activeIndex] ?? filtered[0];
      if (option) {
        handleSelect(option);
      }
      return;
    }

    if (e.key === 'Tab') {
      if (!open || !search.trim()) {
        return;
      }
      const option = filtered[activeIndex] ?? filtered[0];
      if (option) {
        handleSelect(option);
      }
      return;
    }

    if (e.key === 'Escape') {
      setOpen(false);
      setSearch(selectedOption?.label ?? '');
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearch('');
    setOpen(false);
    inputRef.current?.focus();
  };

  const dropdown = open && !disabled ? (
    <ul
      ref={dropdownRef}
      data-combo-select-portal="true"
      style={disablePortal ? undefined : dropdownStyle}
      className={`bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-auto ${
        disablePortal ? 'absolute left-0 right-0 mt-1 z-50' : ''
      }`}
      onWheel={(e) => e.stopPropagation()}
    >
      {filtered.length === 0 ? (
        <li className="px-3 py-2 text-sm text-gray-500">No matching items</li>
      ) : (
        filtered.map((opt) => (
          <li
            key={opt.value}
            onMouseEnter={() => setActiveIndex(filtered.findIndex((candidate) => candidate.value === opt.value))}
            onMouseDown={(e) => {
              // mousedown fires before blur so the dropdown doesn't close before we register the click
              e.preventDefault();
              handleSelect(opt);
            }}
            className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 ${
              opt.value === value
                ? 'bg-blue-100 font-medium'
                : filtered[activeIndex]?.value === opt.value
                  ? 'bg-blue-50'
                  : ''
            }`}
          >
            {opt.label}
          </li>
        ))
      )}
    </ul>
  ) : null;

  return (
    <div className={`relative ${className ?? ''}`} ref={ref}>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder={disabled ? 'Loading...' : placeholder}
          disabled={disabled}
          tabIndex={tabIndex}
          className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
        />
        {value && !disabled ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 text-gray-400 hover:text-gray-600"
            tabIndex={-1}
            aria-label="Clear selection"
          >
            ✕
          </button>
        ) : (
          <span className="absolute right-2 text-gray-400 pointer-events-none">
            <svg className={`w-4 h-4 transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
            </svg>
          </span>
        )}
      </div>

      {disablePortal
        ? dropdown
        : typeof document !== 'undefined' && createPortal(dropdown, document.body)}
    </div>
  );
};

export default ComboSelect;

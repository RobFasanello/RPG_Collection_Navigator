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
}

const ComboSelect: React.FC<Props> = ({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  className,
  disablePortal = false,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setOpen(true);
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
            onMouseDown={(e) => {
              // mousedown fires before blur so the dropdown doesn't close before we register the click
              e.preventDefault();
              handleSelect(opt);
            }}
            className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 ${
              opt.value === value ? 'bg-blue-100 font-medium' : ''
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
          onFocus={handleInputFocus}
          placeholder={disabled ? 'Loading...' : placeholder}
          disabled={disabled}
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

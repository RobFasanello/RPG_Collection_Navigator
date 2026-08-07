import { useEffect, useRef, useState } from 'react';

interface SelectionScopeMenuProps {
  checked: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  tabIndex?: number;
  onSelectPage: () => void;
  onSelectAll: () => void;
}

export default function SelectionScopeMenu({
  checked,
  disabled = false,
  ariaLabel = 'Selection options',
  tabIndex,
  onSelectPage,
  onSelectAll,
}: SelectionScopeMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const handleSelect = (callback: () => void) => {
    setIsOpen(false);
    callback();
  };

  return (
    <div ref={containerRef} className="relative inline-flex">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => {
          event.preventDefault();
          if (!disabled) {
            setIsOpen(true);
          }
        }}
        onClick={(event) => event.stopPropagation()}
        aria-label={ariaLabel}
        tabIndex={tabIndex}
        disabled={disabled}
        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />

      {isOpen && !disabled ? (
        <div className="absolute left-0 top-full z-20 mt-2 min-w-[140px] rounded-md border border-gray-200 bg-white p-1 shadow-lg">
          <button
            type="button"
            onClick={() => handleSelect(onSelectPage)}
            className="flex w-full items-center rounded px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
          >
            Select Page
          </button>
          <button
            type="button"
            onClick={() => handleSelect(onSelectAll)}
            className="flex w-full items-center rounded px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
          >
            Select All
          </button>
        </div>
      ) : null}
    </div>
  );
}

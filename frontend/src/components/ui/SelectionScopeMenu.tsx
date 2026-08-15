import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateMenuPosition = () => {
    const triggerRect = triggerRef.current?.getBoundingClientRect();
    if (!triggerRect) {
      return;
    }

    setMenuStyle({
      position: 'fixed',
      left: Math.min(triggerRect.left, window.innerWidth - 148),
      top: triggerRect.bottom + 8,
      zIndex: 9999,
    });
  };

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [isOpen]);

  const handleSelect = (callback: () => void) => {
    setIsOpen(false);
    callback();
  };

  return (
    <div ref={containerRef} className="relative inline-flex">
      <input
        ref={triggerRef}
        type="checkbox"
        checked={checked}
        onChange={(event) => {
          event.preventDefault();
          if (!disabled) {
            updateMenuPosition();
            setIsOpen(true);
          }
        }}
        onClick={(event) => event.stopPropagation()}
        aria-label={ariaLabel}
        tabIndex={tabIndex}
        disabled={disabled}
        className="h-4 w-4 rounded border-[var(--arcane-border-light)] accent-[var(--arcane-gold-500)] focus:ring-[var(--arcane-gold-600)]"
      />

      {isOpen && !disabled && typeof document !== 'undefined' ? createPortal(
        <div
          ref={menuRef}
          style={menuStyle}
          className="min-w-[140px] rounded-md border border-[var(--arcane-border-light)] bg-[var(--arcane-paper-raised)] p-1 shadow-lg"
        >
          <button
            type="button"
            onClick={() => handleSelect(onSelectPage)}
            className="flex w-full items-center rounded px-3 py-2 text-left text-sm text-[var(--arcane-ink-900)] hover:bg-[var(--arcane-paper)]"
          >
            Select Page
          </button>
          <button
            type="button"
            onClick={() => handleSelect(onSelectAll)}
            className="flex w-full items-center rounded px-3 py-2 text-left text-sm text-[var(--arcane-ink-900)] hover:bg-[var(--arcane-paper)]"
          >
            Select All
          </button>
        </div>,
        document.body
      ) : null}
    </div>
  );
}

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface RowActionsMenuItem {
  key: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  separatorBefore?: boolean;
}

interface RowActionsMenuProps {
  items: RowActionsMenuItem[];
  ariaLabel?: string;
  disabled?: boolean;
  title?: string;
  onOpenChange?: (open: boolean) => void;
  triggerIcon?: LucideIcon;
}

export default function RowActionsMenu({ items, ariaLabel = 'Open menu', disabled = false, title, onOpenChange, triggerIcon: TriggerIcon = MoreHorizontal }: RowActionsMenuProps) {
  return (
    <DropdownMenu.Root onOpenChange={onOpenChange}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          onClick={(event) => event.stopPropagation()}
          disabled={disabled}
          aria-label={ariaLabel}
          title={title}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--arcane-ink-soft)] hover:bg-[var(--arcane-paper)] hover:text-[var(--arcane-ink-900)] disabled:opacity-50"
        >
          <TriggerIcon className="h-4 w-4" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-[9999] min-w-[160px] rounded-md border border-[var(--arcane-border-light)] bg-[var(--arcane-paper-raised)] p-1 shadow-lg"
          onClick={(event) => event.stopPropagation()}
        >
          {items.map((item) => (
            <div key={item.key}>
              {item.separatorBefore ? <DropdownMenu.Separator className="my-1 h-px bg-[var(--arcane-border-light)]" /> : null}
              <DropdownMenu.Item
                disabled={item.disabled}
                onSelect={() => item.onClick()}
                className={`flex w-full cursor-pointer items-center rounded px-3 py-2 text-left text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ${
                  item.destructive
                    ? 'text-red-600 data-[highlighted]:bg-red-50'
                    : 'text-[var(--arcane-ink-900)] data-[highlighted]:bg-amber-100'
                }`}
              >
                {item.label}
              </DropdownMenu.Item>
            </div>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

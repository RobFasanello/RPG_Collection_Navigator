import React from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  onClose?: () => void;
  contentClassName?: string;
}

export const Dialog: React.FC<DialogProps> = ({
  open,
  onOpenChange,
  title,
  children,
  onClose,
  contentClassName,
}) => {
  const isComboSelectPortalTarget = (target: EventTarget | null) => {
    if (!target) {
      return false;
    }

    const elementTarget =
      target instanceof Element
        ? target
        : target instanceof Node
        ? target.parentElement
        : null;

    if (!elementTarget) {
      return false;
    }

    return !!elementTarget.closest('[data-combo-select-portal="true"]');
  };

  const getOutsideEventTarget = (event: any): EventTarget | null => {
    return event?.detail?.originalEvent?.target ?? event?.target ?? null;
  };

  const preventDismissForComboSelectPortal = (event: any) => {
    if (isComboSelectPortalTarget(getOutsideEventTarget(event))) {
      event.preventDefault();
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (!newOpen && onClose) {
      onClose();
    }
  };

  return (
    <RadixDialog.Root open={open} onOpenChange={handleOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <RadixDialog.Content
          onInteractOutside={preventDismissForComboSelectPortal}
          onPointerDownOutside={preventDismissForComboSelectPortal}
          onFocusOutside={preventDismissForComboSelectPortal}
          className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg p-6 max-h-[90vh] overflow-y-auto z-50 w-[92vw] max-w-4xl ${contentClassName || ''}`}
        >
          <div className="flex items-center justify-between mb-4">
            <RadixDialog.Title className="text-xl font-semibold text-gray-900">
              {title}
            </RadixDialog.Title>
            <RadixDialog.Close asChild>
              <button className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
                ×
              </button>
            </RadixDialog.Close>
          </div>
          <div>{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
};

import React from 'react';
import * as RadixAlertDialog from '@radix-ui/react-alert-dialog';

interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  contentClassName?: string;
}

const AlertDialog: React.FC<AlertDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  contentClassName,
}) => {
  return (
    <RadixAlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixAlertDialog.Portal>
        <RadixAlertDialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <RadixAlertDialog.Content
          className={`fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-lg border border-[var(--arcane-border-light)] bg-[var(--arcane-paper-raised)] p-6 shadow-lg ${contentClassName || ''}`}
        >
          <div className="space-y-5">
            <div className="space-y-2">
              <RadixAlertDialog.Title className="text-lg font-semibold text-[var(--arcane-ink-900)]">
                {title}
              </RadixAlertDialog.Title>
              {description ? (
                <RadixAlertDialog.Description className="text-sm text-[var(--arcane-ink-soft)]">
                  {description}
                </RadixAlertDialog.Description>
              ) : null}
            </div>

            {children ? <div>{children}</div> : null}

            {footer ? <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">{footer}</div> : null}
          </div>
        </RadixAlertDialog.Content>
      </RadixAlertDialog.Portal>
    </RadixAlertDialog.Root>
  );
};

export default AlertDialog;

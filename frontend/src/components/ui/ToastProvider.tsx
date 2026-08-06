import React from 'react';
import * as RadixToast from '@radix-ui/react-toast';

export type ToastVariant = 'default' | 'success' | 'info' | 'warning' | 'error';

export interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
}

interface ToastMessage extends ToastInput {
  id: number;
}

interface ToastContextValue {
  toast: (input: ToastInput) => void;
  dismissToast: (id: number) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

const variantClassMap: Record<ToastVariant, string> = {
  default: 'border-gray-200 bg-white text-gray-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  info: 'border-blue-200 bg-blue-50 text-blue-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  error: 'border-red-200 bg-red-50 text-red-900',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = React.useState<ToastMessage[]>([]);

  const dismissToast = React.useCallback((id: number) => {
    setMessages((current) => current.filter((message) => message.id !== id));
  }, []);

  const toast = React.useCallback((input: ToastInput) => {
    const id = Date.now() + Math.floor(Math.random() * 1000000);
    setMessages((current) => [
      ...current,
      {
        ...input,
        id,
      },
    ]);
  }, []);

  const contextValue = React.useMemo(
    () => ({ toast, dismissToast }),
    [toast, dismissToast]
  );

  return (
    <ToastContext.Provider value={contextValue}>
      <RadixToast.Provider swipeDirection="right">
        {children}

        {messages.map((message) => {
          const variant = message.variant || 'default';
          const duration = message.durationMs ?? 4500;

          return (
            <RadixToast.Root
              key={message.id}
              open
              duration={duration}
              onOpenChange={(open) => {
                if (!open) {
                  dismissToast(message.id);
                }
              }}
              className={`group pointer-events-auto w-[360px] rounded-lg border p-4 shadow-lg ${variantClassMap[variant]}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <RadixToast.Title className="text-sm font-semibold">
                    {message.title}
                  </RadixToast.Title>
                  {message.description ? (
                    <RadixToast.Description className="mt-1 text-sm text-current/85">
                      {message.description}
                    </RadixToast.Description>
                  ) : null}
                </div>

                <RadixToast.Close asChild>
                  <button
                    type="button"
                    aria-label="Dismiss toast"
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-current/70 hover:bg-black/10 hover:text-current"
                  >
                    ×
                  </button>
                </RadixToast.Close>
              </div>
            </RadixToast.Root>
          );
        })}

        <RadixToast.Viewport className="fixed bottom-6 right-6 z-50 flex w-[420px] max-w-[92vw] flex-col gap-3 outline-none" />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }

  return context;
}

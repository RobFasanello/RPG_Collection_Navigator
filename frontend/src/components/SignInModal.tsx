import { useRef } from 'react';
import useModalFocusTrap from '../hooks/useModalFocusTrap';

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Your account isn't set up yet. Ask an administrator to add you.",
  login_failed: 'Sign-in failed. Please try again.',
};

type Props = {
  open: boolean;
  onClose: () => void;
  authError?: string | null;
};

export default function SignInModal({ open, onClose, authError }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const containerRef = useModalFocusTrap<HTMLDivElement>(open, onClose);

  if (!open) return null;

  const errorMessage = authError ? ERROR_MESSAGES[authError] ?? 'Sign-in failed. Please try again.' : null;

  return (
    <div
      ref={overlayRef}
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      onClick={(event) => {
        if (event.target === overlayRef.current) onClose();
      }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sign-in-modal-title"
        tabIndex={-1}
        className="relative w-full max-w-sm border border-[var(--arcane-line)] bg-[var(--arcane-ink-900)] p-8 text-center shadow-[0_24px_48px_rgba(0,0,0,0.45)] outline-none"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute right-3 top-3 text-2xl leading-none text-[var(--arcane-muted)]/70 transition hover:text-[var(--arcane-ivory)]"
        >
          ×
        </button>

        <img
          src="/favicon.png"
          alt=""
          className="mx-auto h-14 w-14 rounded-sm object-contain ring-1 ring-[var(--arcane-gold-600)]"
        />
        <h2 id="sign-in-modal-title" className="font-display mt-4 text-xl font-bold uppercase tracking-[0.08em] text-[var(--arcane-ivory-bright)]">
          Sign In
        </h2>
        <p className="mt-1 text-sm text-[var(--arcane-muted)]/85">Sign in with Google to view your collection.</p>

        {errorMessage && (
          <div className="mt-4 border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {errorMessage}
          </div>
        )}

        <a
          href="/api/auth/login"
          className="mt-6 inline-flex w-full items-center justify-center gap-2 border border-[var(--arcane-gold-500)] bg-[var(--arcane-gold-500)] px-4 py-3 text-sm font-bold uppercase tracking-[0.18em] text-[var(--arcane-ink-950)] transition hover:bg-[var(--arcane-gold-300)]"
        >
          Sign in with Google
        </a>
      </div>
    </div>
  );
}

import * as React from "react"

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <button
    className={`inline-flex h-10 items-center justify-center rounded-md border border-[var(--arcane-gold-500)] bg-[var(--arcane-gold-500)] px-4 py-2 text-sm font-medium text-[var(--arcane-ink-950)] transition-colors hover:bg-[var(--arcane-gold-300)] focus:outline-none focus:ring-2 focus:ring-[var(--arcane-gold-600)] focus:ring-offset-2 focus:ring-offset-[var(--arcane-ink-950)] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    ref={ref}
    {...props}
  />
))
Button.displayName = "Button"

export { Button }
